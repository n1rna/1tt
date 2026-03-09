package handler

import (
	"context"
	"crypto/rand"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"path/filepath"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/n1rna/1two/api/internal/config"
	"github.com/n1rna/1two/api/internal/middleware"
	"github.com/n1rna/1two/api/internal/storage"
)

type FileInfo struct {
	ID             string `json:"id"`
	Name           string `json:"name"`
	OriginalName   string `json:"originalName"`
	Size           int64  `json:"size"`
	MimeType       string `json:"mimeType"`
	CreatedAt      string `json:"createdAt"`
	LastAccessedAt string `json:"lastAccessedAt"`
	Permanent      bool   `json:"permanent"`
	URL            string `json:"url"`
}

func generateID() string {
	b := make([]byte, 16)
	rand.Read(b)
	return hex.EncodeToString(b)
}

const maxUploadSize = 50 << 20 // 50 MB

func UploadFile(cfg *config.Config, db *sql.DB, r2 *storage.R2Client) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		userID := middleware.GetUserID(r.Context())
		if userID == "" {
			http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
			return
		}

		r.Body = http.MaxBytesReader(w, r.Body, maxUploadSize)
		if err := r.ParseMultipartForm(maxUploadSize); err != nil {
			http.Error(w, `{"error":"file too large (max 50MB)"}`, http.StatusBadRequest)
			return
		}

		file, header, err := r.FormFile("file")
		if err != nil {
			http.Error(w, `{"error":"no file provided"}`, http.StatusBadRequest)
			return
		}
		defer file.Close()

		fileID := generateID()
		ext := filepath.Ext(header.Filename)
		storedName := fileID + ext
		contentType := header.Header.Get("Content-Type")
		r2Key := userID + "/" + storedName

		// Upload to R2
		if err := r2.Upload(r.Context(), r2Key, file, contentType, header.Size); err != nil {
			log.Printf("r2 upload error: %v", err)
			http.Error(w, `{"error":"failed to store file"}`, http.StatusInternalServerError)
			return
		}

		const q = `
			INSERT INTO files (id, user_id, filename, original_name, content_type, size, r2_key)
			VALUES ($1, $2, $3, $4, $5, $6, $7)
			RETURNING created_at, last_accessed_at`

		var createdAt, lastAccessedAt time.Time
		err = db.QueryRowContext(r.Context(), q,
			fileID, userID, storedName, header.Filename, contentType, header.Size, r2Key,
		).Scan(&createdAt, &lastAccessedAt)
		if err != nil {
			// Best-effort cleanup from R2
			r2.Delete(context.Background(), r2Key)
			http.Error(w, `{"error":"failed to record file"}`, http.StatusInternalServerError)
			return
		}

		info := FileInfo{
			ID:             fileID,
			Name:           storedName,
			OriginalName:   header.Filename,
			Size:           header.Size,
			MimeType:       contentType,
			CreatedAt:      createdAt.UTC().Format(time.RFC3339),
			LastAccessedAt: lastAccessedAt.UTC().Format(time.RFC3339),
			URL:            fmt.Sprintf("/api/proxy/files/%s", fileID),
		}

		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusCreated)
		json.NewEncoder(w).Encode(info)
	}
}

func ListFiles(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		userID := middleware.GetUserID(r.Context())
		if userID == "" {
			http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
			return
		}

		const q = `
			SELECT id, filename, original_name, content_type, size, created_at, last_accessed_at, permanent
			FROM files
			WHERE user_id = $1
			ORDER BY created_at DESC`

		rows, err := db.QueryContext(r.Context(), q, userID)
		if err != nil {
			http.Error(w, `{"error":"failed to list files"}`, http.StatusInternalServerError)
			return
		}
		defer rows.Close()

		files := make([]FileInfo, 0)
		for rows.Next() {
			var f FileInfo
			var createdAt, lastAccessedAt time.Time
			if err := rows.Scan(&f.ID, &f.Name, &f.OriginalName, &f.MimeType, &f.Size, &createdAt, &lastAccessedAt, &f.Permanent); err != nil {
				http.Error(w, `{"error":"failed to read files"}`, http.StatusInternalServerError)
				return
			}
			f.CreatedAt = createdAt.UTC().Format(time.RFC3339)
			f.LastAccessedAt = lastAccessedAt.UTC().Format(time.RFC3339)
			f.URL = fmt.Sprintf("/api/proxy/files/%s", f.ID)
			files = append(files, f)
		}
		if err := rows.Err(); err != nil {
			http.Error(w, `{"error":"failed to iterate files"}`, http.StatusInternalServerError)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{"files": files})
	}
}

func GetFile(db *sql.DB, r2 *storage.R2Client) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		userID := middleware.GetUserID(r.Context())
		fileID := chi.URLParam(r, "id")

		const q = `
			SELECT r2_key, original_name
			FROM files
			WHERE id = $1 AND user_id = $2`

		var r2Key, originalName string
		err := db.QueryRowContext(r.Context(), q, fileID, userID).
			Scan(&r2Key, &originalName)
		if err == sql.ErrNoRows {
			http.Error(w, `{"error":"file not found"}`, http.StatusNotFound)
			return
		}
		if err != nil {
			http.Error(w, `{"error":"failed to look up file"}`, http.StatusInternalServerError)
			return
		}

		// Update last_accessed_at (fire-and-forget)
		go func() {
			db.ExecContext(context.Background(),
				`UPDATE files SET last_accessed_at = NOW() WHERE id = $1`, fileID)
		}()

		// Generate presigned URL (15 min)
		signedURL, err := r2.PresignedURL(r.Context(), r2Key, originalName, 15*time.Minute)
		if err != nil {
			log.Printf("presign error: %v", err)
			http.Error(w, `{"error":"failed to generate download URL"}`, http.StatusInternalServerError)
			return
		}

		http.Redirect(w, r, signedURL, http.StatusFound)
	}
}

func DeleteFile(db *sql.DB, r2 *storage.R2Client) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		userID := middleware.GetUserID(r.Context())
		fileID := chi.URLParam(r, "id")

		const q = `
			DELETE FROM files
			WHERE id = $1 AND user_id = $2
			RETURNING r2_key`

		var r2Key string
		err := db.QueryRowContext(r.Context(), q, fileID, userID).Scan(&r2Key)
		if err == sql.ErrNoRows {
			http.Error(w, `{"error":"file not found"}`, http.StatusNotFound)
			return
		}
		if err != nil {
			http.Error(w, `{"error":"failed to delete file"}`, http.StatusInternalServerError)
			return
		}

		// Delete from R2 (best-effort)
		if err := r2.Delete(r.Context(), r2Key); err != nil {
			log.Printf("r2 delete error for %s: %v", r2Key, err)
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]string{"status": "deleted"})
	}
}

// CleanupExpiredFiles deletes files not accessed in 90 days (unless permanent).
// Protected by internal secret header.
func CleanupExpiredFiles(cfg *config.Config, db *sql.DB, r2 *storage.R2Client) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if cfg.InternalSecret == "" || r.Header.Get("X-Internal-Secret") != cfg.InternalSecret {
			http.Error(w, `{"error":"forbidden"}`, http.StatusForbidden)
			return
		}

		const q = `
			SELECT id, r2_key FROM files
			WHERE NOT permanent
			  AND last_accessed_at < NOW() - INTERVAL '90 days'
			LIMIT 500`

		rows, err := db.QueryContext(r.Context(), q)
		if err != nil {
			http.Error(w, `{"error":"query failed"}`, http.StatusInternalServerError)
			return
		}
		defer rows.Close()

		var deleted int
		for rows.Next() {
			var id, r2Key string
			if err := rows.Scan(&id, &r2Key); err != nil {
				continue
			}

			if err := r2.Delete(r.Context(), r2Key); err != nil {
				log.Printf("cleanup: r2 delete %s failed: %v", r2Key, err)
				continue
			}

			if _, err := db.ExecContext(r.Context(), `DELETE FROM files WHERE id = $1`, id); err != nil {
				log.Printf("cleanup: db delete %s failed: %v", id, err)
				continue
			}
			deleted++
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]int{"deleted": deleted})
	}
}
