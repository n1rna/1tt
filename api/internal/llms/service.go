package llms

import (
	"context"
	"crypto/rand"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"log"
	"net"
	"net/url"
	"strings"
	"sync"
	"time"

	"github.com/n1rna/1tt/api/internal/ai"
	"github.com/n1rna/1tt/api/internal/billing"
	"github.com/n1rna/1tt/api/internal/crawl"
	"github.com/n1rna/1tt/api/internal/gitclone"
	"github.com/n1rna/1tt/api/internal/storage"
)

// maxWorkers is the maximum number of jobs processed concurrently.
const maxWorkers = 3

// pollInterval is how frequently the worker loop checks for pending jobs.
const pollInterval = 2 * time.Second

// Service orchestrates llms.txt generation jobs using a DB-backed queue
// with a bounded worker pool.
type Service struct {
	db          *sql.DB
	r2          *storage.R2Client
	crawlClient *crawl.Client
	llmCfg      ai.LLMConfig

	// Worker pool coordination
	sem        chan struct{}           // semaphore limiting concurrent workers
	activeJobs sync.Map               // jobID -> context.CancelFunc for cancellation
	cancelLoop context.CancelFunc     // stops the worker loop
	wg         sync.WaitGroup         // tracks in-flight workers for graceful shutdown
}

// GenerateRequest holds the parameters for a new llms.txt generation job.
type GenerateRequest struct {
	URL         string `json:"url"`
	ScanDepth   int    `json:"scanDepth"`
	MaxPages    int    `json:"maxPages"`
	DetailLevel string `json:"detailLevel"`
	FileName    string `json:"fileName"`
	NotifyEmail string `json:"notifyEmail,omitempty"`
}

// Job is the public representation of an llms_jobs row.
type Job struct {
	ID           string     `json:"id"`
	URL          string     `json:"url"`
	Status       string     `json:"status"`
	ErrorMessage string     `json:"error,omitempty"`
	PagesCrawled int        `json:"pagesCrawled"`
	TokensUsed   int        `json:"tokensUsed"`
	DetailLevel  string     `json:"detailLevel"`
	NotifyEmail  string     `json:"notifyEmail,omitempty"`
	Files        []File     `json:"files,omitempty"`
	CreatedAt    time.Time  `json:"createdAt"`
	CompletedAt  *time.Time `json:"completedAt,omitempty"`
}

// File is the public representation of an llms_files row.
type File struct {
	ID        string `json:"id"`
	FileName  string `json:"fileName"`
	Size      int64  `json:"size"`
	Version   string `json:"version"`
	Content   string `json:"content,omitempty"`
	Slug      string `json:"slug,omitempty"`
	Published bool   `json:"published"`
}

// CacheInfo reports whether a crawl result is cached for the given URL + depth.
type CacheInfo struct {
	Cached     bool      `json:"cached"`
	CachedAt   time.Time `json:"cachedAt,omitzero"`
	PagesCount int       `json:"pagesCount,omitempty"`
	ExpiresAt  time.Time `json:"expiresAt,omitzero"`
}

// NewService creates a new Service and starts the background worker loop.
// Call Stop() to shut it down gracefully.
func NewService(db *sql.DB, r2 *storage.R2Client, crawlClient *crawl.Client, llmCfg ai.LLMConfig) *Service {
	ctx, cancel := context.WithCancel(context.Background())

	s := &Service{
		db:          db,
		r2:          r2,
		crawlClient: crawlClient,
		llmCfg:      llmCfg,
		sem:         make(chan struct{}, maxWorkers),
		cancelLoop:  cancel,
	}

	// Recover any jobs that were in-flight when the server last stopped
	s.recoverStaleJobs()

	// Start the worker loop
	go s.workerLoop(ctx)

	return s
}

// Stop gracefully shuts down the worker loop and waits for in-flight jobs.
func (s *Service) Stop() {
	s.cancelLoop()
	s.wg.Wait()
}

// ─── Worker loop ─────────────────────────────────────────────────────────────

// workerLoop polls the DB for pending jobs and dispatches them to workers.
func (s *Service) workerLoop(ctx context.Context) {
	ticker := time.NewTicker(pollInterval)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			s.dispatchPendingJobs(ctx)
		}
	}
}

// dispatchPendingJobs claims pending jobs from the DB and starts workers.
func (s *Service) dispatchPendingJobs(ctx context.Context) {
	// Use SELECT ... FOR UPDATE SKIP LOCKED to safely claim jobs even if
	// we ever scale to multiple instances. SKIP LOCKED ensures no contention.
	const claimQ = `
		UPDATE llms_jobs
		SET status = 'crawling', updated_at = NOW()
		WHERE id = (
			SELECT id FROM llms_jobs
			WHERE status = 'pending'
			ORDER BY created_at ASC
			LIMIT 1
			FOR UPDATE SKIP LOCKED
		)
		RETURNING id`

	for {
		// Check if we have capacity
		select {
		case s.sem <- struct{}{}:
			// Acquired a slot — try to claim a job
		default:
			// All workers busy
			return
		}

		var jobID string
		err := s.db.QueryRowContext(ctx, claimQ).Scan(&jobID)
		if err == sql.ErrNoRows {
			// No pending jobs — release the slot
			<-s.sem
			return
		}
		if err != nil {
			log.Printf("llms: failed to claim job: %v", err)
			<-s.sem
			return
		}

		// Dispatch the worker
		s.wg.Add(1)
		go func(id string) {
			defer s.wg.Done()
			defer func() { <-s.sem }() // release the semaphore slot
			s.processJob(id)
		}(jobID)
	}
}

// recoverStaleJobs resets jobs that were in-flight when the server stopped.
// Called once on startup.
func (s *Service) recoverStaleJobs() {
	const q = `
		UPDATE llms_jobs
		SET status = 'pending', error_message = NULL, updated_at = NOW()
		WHERE status IN ('crawling', 'processing')
		  AND updated_at < NOW() - INTERVAL '10 minutes'`

	result, err := s.db.Exec(q)
	if err != nil {
		log.Printf("llms: failed to recover stale jobs: %v", err)
		return
	}
	if n, _ := result.RowsAffected(); n > 0 {
		log.Printf("llms: recovered %d stale jobs back to pending", n)
	}
}

// ─── Job processing ──────────────────────────────────────────────────────────

// processJob runs the full pipeline for a single job. It is called by a
// worker goroutine managed by the semaphore.
func (s *Service) processJob(jobID string) {
	ctx, cancel := context.WithCancel(context.Background())
	s.activeJobs.Store(jobID, cancel)
	defer func() {
		cancel()
		s.activeJobs.Delete(jobID)
	}()

	if err := s.runJob(ctx, jobID); err != nil {
		log.Printf("llms: job %s failed: %v", jobID, err)
		s.db.ExecContext(context.Background(),
			`UPDATE llms_jobs SET status = 'failed', error_message = $1, updated_at = NOW() WHERE id = $2`,
			err.Error(), jobID)
	}
}

// runJob performs the actual crawl/clone + AI generation + upload work.
func (s *Service) runJob(ctx context.Context, jobID string) error {
	// Load job details
	const fetchQ = `
		SELECT user_id, url, normalized_url, scan_depth, max_pages, detail_level, file_name
		FROM llms_jobs WHERE id = $1`
	var userID, rawURL, normalizedURL, detailLevel, fileName string
	var scanDepth, maxPages int
	if err := s.db.QueryRowContext(ctx, fetchQ, jobID).
		Scan(&userID, &rawURL, &normalizedURL, &scanDepth, &maxPages, &detailLevel, &fileName); err != nil {
		return fmt.Errorf("fetch job: %w", err)
	}

	// --- Content acquisition phase ---
	// (status was already set to 'crawling' by dispatchPendingJobs)
	var pages []crawl.CrawlPage
	sourceType := "website"

	// Check cache first
	const cacheQ = `
		SELECT id, crawl_data, pages_count, created_at, expires_at
		FROM llms_cache
		WHERE normalized_url = $1 AND scan_depth = $2 AND expires_at > NOW()`
	var cacheID string
	var crawlDataJSON []byte
	var pagesCount int
	var cacheCreatedAt, cacheExpiresAt time.Time

	err := s.db.QueryRowContext(ctx, cacheQ, normalizedURL, scanDepth).
		Scan(&cacheID, &crawlDataJSON, &pagesCount, &cacheCreatedAt, &cacheExpiresAt)

	if err == sql.ErrNoRows {
		// Cache miss — acquire content

		// GitHub repos: clone directly instead of crawling through Cloudflare
		if ghInfo := gitclone.ParseGitHubURL(rawURL); ghInfo != nil {
			log.Printf("llms: job %s detected GitHub repo %s/%s — cloning", jobID, ghInfo.Owner, ghInfo.Repo)
			sourceType = "github"
			var cloneErr error
			pages, cloneErr = gitclone.CloneAndExtract(ctx, ghInfo)
			if cloneErr != nil {
				return fmt.Errorf("clone GitHub repo: %w", cloneErr)
			}
		} else {
			// Non-GitHub URLs: use Cloudflare crawl
			if maxPages <= 0 {
				maxPages = 50
			}
			cfJobID, crawlErr := s.crawlClient.StartCrawl(ctx, crawl.CrawlRequest{
				URL:   rawURL,
				Limit: maxPages,
				Depth: scanDepth,
			})
			if crawlErr != nil {
				return fmt.Errorf("start crawl: %w", crawlErr)
			}

			// Persist the Cloudflare job ID
			s.db.ExecContext(ctx,
				`UPDATE llms_jobs SET cf_job_id = $1, updated_at = NOW() WHERE id = $2`,
				cfJobID, jobID)

			// Poll until complete (also heartbeats updated_at to avoid stale recovery)
			if pollErr := s.pollCrawl(ctx, jobID, cfJobID); pollErr != nil {
				return pollErr
			}

			// Fetch all pages
			var resultsErr error
			pages, resultsErr = s.crawlClient.GetResults(ctx, cfJobID)
			if resultsErr != nil {
				return fmt.Errorf("get crawl results: %w", resultsErr)
			}
		}

		// Store in cache (expires in 14 days)
		data, marshalErr := json.Marshal(pages)
		if marshalErr != nil {
			return fmt.Errorf("marshal crawl data: %w", marshalErr)
		}
		newCacheID := generateID()
		expiresAt := time.Now().UTC().Add(14 * 24 * time.Hour)
		log.Printf("llms: writing cache for %q (depth=%d, pages=%d)", normalizedURL, scanDepth, len(pages))
		if _, cacheInsertErr := s.db.ExecContext(context.Background(),
			`INSERT INTO llms_cache (id, normalized_url, scan_depth, crawl_data, pages_count, expires_at)
			 VALUES ($1, $2, $3, $4, $5, $6)
			 ON CONFLICT (normalized_url, scan_depth) DO UPDATE
			   SET crawl_data = EXCLUDED.crawl_data,
			       pages_count = EXCLUDED.pages_count,
			       created_at = NOW(),
			       expires_at = EXCLUDED.expires_at`,
			newCacheID, normalizedURL, scanDepth, data, len(pages), expiresAt); cacheInsertErr != nil {
			log.Printf("llms: cache insert error for %q: %v", normalizedURL, cacheInsertErr)
		}

	} else if err != nil {
		return fmt.Errorf("check cache: %w", err)
	} else {
		// Cache hit
		if err := json.Unmarshal(crawlDataJSON, &pages); err != nil {
			return fmt.Errorf("unmarshal cached crawl data: %w", err)
		}
		log.Printf("llms: job %s using cached crawl for %s (%d pages)", jobID, normalizedURL, pagesCount)
	}

	// Update pages_crawled count
	s.db.ExecContext(ctx,
		`UPDATE llms_jobs SET pages_crawled = $1, updated_at = NOW() WHERE id = $2`,
		len(pages), jobID)

	// --- Generation phase ---
	if err := s.updateStatus(ctx, jobID, "processing"); err != nil {
		return err
	}

	result, err := ai.Run(ctx, &s.llmCfg, ai.AgentConfig{
		Type: ai.AgentLlmsTxt,
		ExtraData: map[string]any{
			"pages":       pages,
			"detailLevel": detailLevel,
			"sourceType":  sourceType,
		},
	})
	if err != nil {
		return fmt.Errorf("generate llms.txt: %w", err)
	}
	content := result.Output
	usage := struct{ InputTokens, OutputTokens int }{result.InputTokens, result.OutputTokens}

	// --- Upsert result cache ---
	resultCacheID := generateID()
	resultCacheExpiry := time.Now().UTC().Add(14 * 24 * time.Hour)
	s.db.ExecContext(context.Background(),
		`INSERT INTO llms_result_cache
		     (id, normalized_url, scan_depth, detail_level, content, tokens_used, expires_at)
		 VALUES ($1, $2, $3, $4, $5, $6, $7)
		 ON CONFLICT (normalized_url, scan_depth, detail_level) DO UPDATE
		     SET content     = EXCLUDED.content,
		         tokens_used = EXCLUDED.tokens_used,
		         created_at  = NOW(),
		         expires_at  = EXCLUDED.expires_at`,
		resultCacheID, normalizedURL, scanDepth, detailLevel, content,
		usage.InputTokens+usage.OutputTokens, resultCacheExpiry)

	// --- Upload to R2 ---
	r2Key := fmt.Sprintf("llms/%s/%s", jobID, fileName)
	size := int64(len(content))

	bodyReader := strings.NewReader(content)
	if err := s.r2.Upload(ctx, r2Key, bodyReader, "text/plain; charset=utf-8", size); err != nil {
		return fmt.Errorf("upload to R2: %w", err)
	}

	// --- Record file ---
	fileID := generateID()
	now := time.Now().UTC()

	s.db.ExecContext(ctx,
		`INSERT INTO llms_files (id, job_id, user_id, r2_key, file_name, version, size, content, created_at)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
		fileID, jobID, userID, r2Key, fileName, detailLevel, size, content, now)

	// --- Record AI usage ---
	usageID := generateID()
	s.db.ExecContext(context.Background(),
		`INSERT INTO ai_usage (id, user_id, feature, tokens_input, tokens_output, job_id, created_at)
		 VALUES ($1, $2, 'llms_txt', $3, $4, $5, $6)`,
		usageID, userID, usage.InputTokens, usage.OutputTokens, jobID, now)

	// --- Mark complete ---
	totalTokens := usage.InputTokens + usage.OutputTokens
	s.db.ExecContext(ctx,
		`UPDATE llms_jobs
		 SET status = 'completed', tokens_used = $1, completed_at = $2, updated_at = $2
		 WHERE id = $3`,
		totalTokens, now, jobID)

	// Track AI token usage in billing meter
	if totalTokens > 0 {
		if _, err := billing.IncrementUsageBy(ctx, s.db, userID, "ai-token-used", int64(totalTokens)); err != nil {
			log.Printf("llms: billing increment error for user %s job %s: %v", userID, jobID, err)
		}
	}

	log.Printf("llms: job %s completed — %d pages, %d tokens", jobID, len(pages), totalTokens)
	return nil
}

// pollCrawl polls the Cloudflare crawl API every 5 seconds until it finishes.
// It also heartbeats updated_at so the stale recovery sweep doesn't claim it.
func (s *Service) pollCrawl(ctx context.Context, jobID, cfJobID string) error {
	ticker := time.NewTicker(5 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return fmt.Errorf("job cancelled")
		case <-ticker.C:
			status, err := s.crawlClient.GetStatus(ctx, cfJobID)
			if err != nil {
				log.Printf("llms: job %s poll error: %v", jobID, err)
				continue
			}

			// Update pages_crawled in DB (also serves as a heartbeat).
			// Use the greater of Total (pages discovered) and Finished (pages completed)
			// so the frontend shows progress as soon as pages are found.
			crawledCount := status.Finished
			if status.Total > crawledCount {
				crawledCount = status.Total
			}
			s.db.ExecContext(ctx,
				`UPDATE llms_jobs SET pages_crawled = $1, cf_status = $2, updated_at = NOW() WHERE id = $3`,
				crawledCount, status.Status, jobID)

			switch status.Status {
			case "completed":
				return nil
			case "failed", "cancelled",
				"cancelled_due_to_timeout", "cancelled_due_to_limits",
				"cancelled_by_user", "errored":
				return fmt.Errorf("crawl job %s ended with status %q", cfJobID, status.Status)
			}
		}
	}
}

// updateStatus sets the status of a job row.
func (s *Service) updateStatus(ctx context.Context, jobID, status string) error {
	_, err := s.db.ExecContext(ctx,
		`UPDATE llms_jobs SET status = $1, updated_at = NOW() WHERE id = $2`,
		status, jobID)
	if err != nil {
		return fmt.Errorf("update status to %q: %w", status, err)
	}
	return nil
}

// ─── Public API methods ──────────────────────────────────────────────────────

func generateID() string {
	b := make([]byte, 16)
	rand.Read(b)
	return hex.EncodeToString(b)
}

var validDetailLevels = map[string]bool{
	"overview": true,
	"standard": true,
	"detailed": true,
}

// StartJob validates the request and inserts a new pending job row.
// The background worker loop will pick it up automatically.
func (s *Service) StartJob(ctx context.Context, userID string, req GenerateRequest) (*Job, error) {
	if err := validateURL(req.URL); err != nil {
		return nil, err
	}

	// Apply defaults
	if req.ScanDepth <= 0 {
		req.ScanDepth = 3
	}
	if req.MaxPages <= 0 {
		req.MaxPages = 50
	}
	if req.MaxPages > 200 {
		req.MaxPages = 200
	}
	if req.DetailLevel == "" {
		req.DetailLevel = "standard"
	}
	if !validDetailLevels[req.DetailLevel] {
		return nil, fmt.Errorf("invalid detailLevel; must be overview, standard, or detailed")
	}
	if req.FileName == "" {
		req.FileName = "llms.txt"
	}

	normalizedURL := crawl.NormalizeURL(req.URL)

	// Enforce concurrent job limit per user (max 3 active)
	const limitQ = `
		SELECT COUNT(*) FROM llms_jobs
		WHERE user_id = $1 AND status IN ('pending', 'crawling', 'processing')`
	var activeCount int
	if err := s.db.QueryRowContext(ctx, limitQ, userID).Scan(&activeCount); err != nil {
		return nil, fmt.Errorf("failed to check active jobs")
	}
	if activeCount >= 3 {
		return nil, fmt.Errorf("maximum of 3 concurrent jobs allowed; wait for existing jobs to complete")
	}

	// Check result cache — if a completed generation exists, skip the queue entirely.
	const resultCacheQ = `
		SELECT content, tokens_used
		FROM llms_result_cache
		WHERE normalized_url = $1 AND scan_depth = $2 AND detail_level = $3 AND expires_at > NOW()`
	var cachedContent string
	var cachedTokens int
	cacheErr := s.db.QueryRowContext(ctx, resultCacheQ, normalizedURL, req.ScanDepth, req.DetailLevel).
		Scan(&cachedContent, &cachedTokens)

	jobID := generateID()
	now := time.Now().UTC()

	if cacheErr == nil {
		// Cache hit — create a completed job immediately.
		const insertCompletedQ = `
			INSERT INTO llms_jobs
				(id, user_id, url, normalized_url, status, scan_depth, max_pages, detail_level, file_name,
				 tokens_used, notify_email, created_at, updated_at, completed_at)
			VALUES ($1, $2, $3, $4, 'completed', $5, $6, $7, $8, $9, $10, $11, $11, $11)`
		if _, err := s.db.ExecContext(ctx, insertCompletedQ,
			jobID, userID, req.URL, normalizedURL, req.ScanDepth, req.MaxPages, req.DetailLevel, req.FileName,
			cachedTokens, nullableString(req.NotifyEmail), now,
		); err != nil {
			return nil, fmt.Errorf("failed to create job")
		}

		// Upload cached content to R2
		r2Key := fmt.Sprintf("llms/%s/%s", jobID, req.FileName)
		size := int64(len(cachedContent))
		bodyReader := strings.NewReader(cachedContent)
		if uploadErr := s.r2.Upload(ctx, r2Key, bodyReader, "text/plain; charset=utf-8", size); uploadErr != nil {
			log.Printf("llms: result cache hit but R2 upload failed for job %s: %v", jobID, uploadErr)
		}

		// Record file
		fileID := generateID()
		s.db.ExecContext(ctx,
			`INSERT INTO llms_files (id, job_id, user_id, r2_key, file_name, version, size, content, created_at)
			 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
			fileID, jobID, userID, r2Key, req.FileName, req.DetailLevel, size, cachedContent, now)

		// Record AI usage
		usageID := generateID()
		s.db.ExecContext(context.Background(),
			`INSERT INTO ai_usage (id, user_id, feature, tokens_input, tokens_output, job_id, created_at)
			 VALUES ($1, $2, 'llms_txt', $3, 0, $4, $5)`,
			usageID, userID, cachedTokens, jobID, now)

		// Cache hits are free — no billing. Tokens were already charged on the original generation.

		log.Printf("llms: job %s served from result cache (%d tokens, not billed)", jobID, cachedTokens)

		completedAt := now
		return &Job{
			ID:          jobID,
			URL:         req.URL,
			Status:      "completed",
			DetailLevel: req.DetailLevel,
			TokensUsed:  cachedTokens,
			NotifyEmail: req.NotifyEmail,
			Files: []File{{
				ID:       fileID,
				FileName: req.FileName,
				Size:     size,
				Version:  req.DetailLevel,
				Content:  cachedContent,
			}},
			CreatedAt:   now,
			CompletedAt: &completedAt,
		}, nil
	} else if cacheErr != sql.ErrNoRows {
		// Unexpected DB error — log and fall through to normal path
		log.Printf("llms: result cache check failed: %v", cacheErr)
	}

	// No cache hit — insert a pending job for the worker loop.
	const insertQ = `
		INSERT INTO llms_jobs
			(id, user_id, url, normalized_url, status, scan_depth, max_pages, detail_level, file_name,
			 notify_email, created_at, updated_at)
		VALUES ($1, $2, $3, $4, 'pending', $5, $6, $7, $8, $9, $10, $10)`

	if _, err := s.db.ExecContext(ctx, insertQ,
		jobID, userID, req.URL, normalizedURL, req.ScanDepth, req.MaxPages, req.DetailLevel, req.FileName,
		nullableString(req.NotifyEmail), now,
	); err != nil {
		return nil, fmt.Errorf("failed to create job")
	}

	return &Job{
		ID:          jobID,
		URL:         req.URL,
		Status:      "pending",
		DetailLevel: req.DetailLevel,
		NotifyEmail: req.NotifyEmail,
		CreatedAt:   now,
	}, nil
}

// nullableString returns nil for an empty string (suitable for nullable TEXT columns).
func nullableString(s string) any {
	if s == "" {
		return nil
	}
	return s
}

// GetJob returns the job and its associated files for the given user.
func (s *Service) GetJob(ctx context.Context, userID, jobID string) (*Job, error) {
	const q = `
		SELECT id, url, status, COALESCE(error_message, ''), pages_crawled, tokens_used,
		       detail_level, created_at, completed_at
		FROM llms_jobs
		WHERE id = $1 AND user_id = $2`

	var job Job
	var completedAt sql.NullTime
	err := s.db.QueryRowContext(ctx, q, jobID, userID).Scan(
		&job.ID, &job.URL, &job.Status, &job.ErrorMessage,
		&job.PagesCrawled, &job.TokensUsed, &job.DetailLevel,
		&job.CreatedAt, &completedAt,
	)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("get job: %w", err)
	}
	if completedAt.Valid {
		job.CompletedAt = &completedAt.Time
	}

	// Load associated files (include content only for completed jobs)
	const filesQ = `
		SELECT id, file_name, size, version, COALESCE(content, ''), COALESCE(slug, ''), COALESCE(published, FALSE)
		FROM llms_files
		WHERE job_id = $1
		ORDER BY created_at ASC`
	rows, err := s.db.QueryContext(ctx, filesQ, jobID)
	if err != nil {
		return nil, fmt.Errorf("get job files: %w", err)
	}
	defer rows.Close()

	for rows.Next() {
		var f File
		if err := rows.Scan(&f.ID, &f.FileName, &f.Size, &f.Version, &f.Content, &f.Slug, &f.Published); err != nil {
			return nil, fmt.Errorf("scan job file: %w", err)
		}
		job.Files = append(job.Files, f)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate job files: %w", err)
	}

	return &job, nil
}

// CheckCache reports whether a valid cache entry exists for the given URL.
// It returns the best available cache (highest page count) regardless of depth.
func (s *Service) CheckCache(ctx context.Context, rawURL string, _ int) (*CacheInfo, error) {
	normalizedURL := crawl.NormalizeURL(rawURL)

	// Check crawl cache first (has page count info).
	const crawlQ = `
		SELECT pages_count, created_at, expires_at
		FROM llms_cache
		WHERE normalized_url = $1 AND expires_at > NOW()
		ORDER BY pages_count DESC
		LIMIT 1`

	var info CacheInfo
	err := s.db.QueryRowContext(ctx, crawlQ, normalizedURL).
		Scan(&info.PagesCount, &info.CachedAt, &info.ExpiresAt)
	if err == nil {
		info.Cached = true
		return &info, nil
	}
	if err != nil && err != sql.ErrNoRows {
		return nil, fmt.Errorf("check cache: %w", err)
	}

	// Fall back to result cache (generated llms.txt output).
	const resultQ = `
		SELECT created_at, expires_at
		FROM llms_result_cache
		WHERE normalized_url = $1 AND expires_at > NOW()
		ORDER BY created_at DESC
		LIMIT 1`

	err = s.db.QueryRowContext(ctx, resultQ, normalizedURL).
		Scan(&info.CachedAt, &info.ExpiresAt)
	if err == nil {
		info.Cached = true
		return &info, nil
	}
	if err != nil && err != sql.ErrNoRows {
		return nil, fmt.Errorf("check result cache: %w", err)
	}

	return &CacheInfo{Cached: false}, nil
}

// CancelJob cancels the context for an active job and marks it as cancelled.
func (s *Service) CancelJob(ctx context.Context, userID, jobID string) error {
	// Verify ownership and current status
	const q = `
		SELECT status FROM llms_jobs WHERE id = $1 AND user_id = $2`
	var status string
	err := s.db.QueryRowContext(ctx, q, jobID, userID).Scan(&status)
	if err == sql.ErrNoRows {
		return fmt.Errorf("job not found")
	}
	if err != nil {
		return fmt.Errorf("get job status: %w", err)
	}

	if status == "completed" || status == "failed" || status == "cancelled" {
		return fmt.Errorf("job is already %s", status)
	}

	// If it's still pending (not yet picked up by a worker), just mark cancelled
	if status == "pending" {
		s.db.ExecContext(context.Background(),
			`UPDATE llms_jobs SET status = 'cancelled', updated_at = NOW() WHERE id = $1`,
			jobID)
		return nil
	}

	// If in-flight, signal the worker goroutine to stop
	if cancelFn, ok := s.activeJobs.Load(jobID); ok {
		cancelFn.(context.CancelFunc)()
	}

	s.db.ExecContext(context.Background(),
		`UPDATE llms_jobs SET status = 'cancelled', updated_at = NOW() WHERE id = $1`,
		jobID)

	return nil
}

// ListJobs returns a paginated list of jobs for a user ordered by created_at DESC,
// with associated files joined. It also returns the total count of jobs for the user.
func (s *Service) ListJobs(ctx context.Context, userID string, limit, offset int) ([]Job, int, error) {
	const countQ = `SELECT COUNT(*) FROM llms_jobs WHERE user_id = $1`
	var total int
	if err := s.db.QueryRowContext(ctx, countQ, userID).Scan(&total); err != nil {
		return nil, 0, fmt.Errorf("count jobs: %w", err)
	}

	const q = `
		SELECT id, url, status, COALESCE(error_message, ''), pages_crawled, tokens_used,
		       detail_level, COALESCE(notify_email, ''), created_at, completed_at
		FROM llms_jobs
		WHERE user_id = $1
		ORDER BY created_at DESC
		LIMIT $2 OFFSET $3`
	rows, err := s.db.QueryContext(ctx, q, userID, limit, offset)
	if err != nil {
		return nil, 0, fmt.Errorf("list jobs: %w", err)
	}
	defer rows.Close()

	var jobs []Job
	for rows.Next() {
		var job Job
		var completedAt sql.NullTime
		if err := rows.Scan(
			&job.ID, &job.URL, &job.Status, &job.ErrorMessage,
			&job.PagesCrawled, &job.TokensUsed, &job.DetailLevel, &job.NotifyEmail,
			&job.CreatedAt, &completedAt,
		); err != nil {
			return nil, 0, fmt.Errorf("scan job: %w", err)
		}
		if completedAt.Valid {
			job.CompletedAt = &completedAt.Time
		}
		jobs = append(jobs, job)
	}
	if err := rows.Err(); err != nil {
		return nil, 0, fmt.Errorf("iterate jobs: %w", err)
	}

	// Fetch files for each job
	const filesQ = `
		SELECT id, file_name, size, version, COALESCE(slug, ''), COALESCE(published, FALSE)
		FROM llms_files
		WHERE job_id = $1
		ORDER BY created_at ASC`
	for i := range jobs {
		fileRows, err := s.db.QueryContext(ctx, filesQ, jobs[i].ID)
		if err != nil {
			return nil, 0, fmt.Errorf("get files for job %s: %w", jobs[i].ID, err)
		}
		for fileRows.Next() {
			var f File
			if err := fileRows.Scan(&f.ID, &f.FileName, &f.Size, &f.Version, &f.Slug, &f.Published); err != nil {
				fileRows.Close()
				return nil, 0, fmt.Errorf("scan file: %w", err)
			}
			jobs[i].Files = append(jobs[i].Files, f)
		}
		fileRows.Close()
		if err := fileRows.Err(); err != nil {
			return nil, 0, fmt.Errorf("iterate files for job %s: %w", jobs[i].ID, err)
		}
	}

	return jobs, total, nil
}

// PublishFile sets the published flag on a file owned by userID.
// When publishing for the first time (slug is empty), a 12-char hex slug is generated.
// Returns the updated File.
func (s *Service) PublishFile(ctx context.Context, userID, fileID string, publish bool) (*File, error) {
	// Verify ownership and fetch current slug
	const selectQ = `
		SELECT id, file_name, size, version, COALESCE(slug, ''), COALESCE(published, FALSE)
		FROM llms_files
		WHERE id = $1 AND user_id = $2`
	var f File
	if err := s.db.QueryRowContext(ctx, selectQ, fileID, userID).
		Scan(&f.ID, &f.FileName, &f.Size, &f.Version, &f.Slug, &f.Published); err == sql.ErrNoRows {
		return nil, fmt.Errorf("file not found")
	} else if err != nil {
		return nil, fmt.Errorf("get file: %w", err)
	}

	// Generate a slug when publishing for the first time
	if publish && f.Slug == "" {
		f.Slug = generateID()[:12]
	}

	const updateQ = `
		UPDATE llms_files
		SET published = $1, slug = $2
		WHERE id = $3
		RETURNING id, file_name, size, version, COALESCE(slug, ''), COALESCE(published, FALSE)`
	if err := s.db.QueryRowContext(ctx, updateQ, publish, nullableString(f.Slug), fileID).
		Scan(&f.ID, &f.FileName, &f.Size, &f.Version, &f.Slug, &f.Published); err != nil {
		return nil, fmt.Errorf("update file: %w", err)
	}

	return &f, nil
}

// GetPublicFile returns the text content of a published file by slug.
// Returns an error if the file does not exist or is not published.
func (s *Service) GetPublicFile(ctx context.Context, slug string) (string, error) {
	const q = `
		SELECT COALESCE(content, '')
		FROM llms_files
		WHERE slug = $1 AND published = TRUE`
	var content string
	if err := s.db.QueryRowContext(ctx, q, slug).Scan(&content); err == sql.ErrNoRows {
		return "", fmt.Errorf("file not found")
	} else if err != nil {
		return "", fmt.Errorf("get public file: %w", err)
	}
	return content, nil
}

// ─── Validation ──────────────────────────────────────────────────────────────

func validateURL(rawURL string) error {
	u, err := url.Parse(rawURL)
	if err != nil {
		return fmt.Errorf("invalid URL: %w", err)
	}
	if u.Scheme != "http" && u.Scheme != "https" {
		return fmt.Errorf("URL must use http or https scheme")
	}
	if u.Host == "" {
		return fmt.Errorf("URL must include a host")
	}

	host := u.Hostname()

	if ip := net.ParseIP(host); ip != nil {
		if ip.IsLoopback() || ip.IsPrivate() || ip.IsUnspecified() || ip.IsLinkLocalUnicast() {
			return fmt.Errorf("URL must not point to a private or loopback address")
		}
	}

	lower := strings.ToLower(host)
	if lower == "localhost" || strings.HasSuffix(lower, ".local") || strings.HasSuffix(lower, ".internal") {
		return fmt.Errorf("URL must not point to a local or internal host")
	}

	return nil
}
