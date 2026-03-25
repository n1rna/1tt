package life

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"time"

	"github.com/google/uuid"
)

// PlanCycle identifies which daily planning cycle to run.
type PlanCycle string

const (
	CycleEveningPlan   PlanCycle = "evening_plan"
	CycleMorningPlan   PlanCycle = "morning_plan"
	CycleEveningReview PlanCycle = "evening_review"
)

// SchedulerUser holds the data needed to decide which cycle is due for a user.
type SchedulerUser struct {
	UserID            string
	Timezone          string
	WakeTime          string // "07:00"
	SleepTime         string // "23:00"
	LastEveningPlan   *time.Time
	LastMorningPlan   *time.Time
	LastEveningReview *time.Time
}

// DueCycle is a single user+cycle pair that needs to be processed.
type DueCycle struct {
	UserID string    `json:"user_id"`
	Cycle  PlanCycle `json:"cycle"`
}

// CheckDueCycles scans all enabled users and returns which cycles are due now.
// This is the "producer" side — it doesn't execute anything, just determines work.
func CheckDueCycles(ctx context.Context, db *sql.DB) ([]DueCycle, error) {
	users, err := loadSchedulerUsers(ctx, db)
	if err != nil {
		return nil, fmt.Errorf("scheduler: load users: %w", err)
	}

	var due []DueCycle
	for _, user := range users {
		cycle := determineDueCycle(user)
		if cycle != "" {
			due = append(due, DueCycle{UserID: user.UserID, Cycle: cycle})
		}
	}

	log.Printf("scheduler: checked %d users, %d cycles due", len(users), len(due))
	return due, nil
}

// RunUserCycle executes a single planning cycle for one user.
// This is the "consumer" side — called per queue message.
func RunUserCycle(ctx context.Context, db *sql.DB, agent *Agent, userID string, cycle PlanCycle) error {
	// Load user data for prompt building.
	user, err := loadSchedulerUser(ctx, db, userID)
	if err != nil {
		return fmt.Errorf("load user: %w", err)
	}
	if user == nil {
		return fmt.Errorf("user %s not found or agent not enabled", userID)
	}

	return runCycleForUser(ctx, db, agent, *user, cycle)
}

// loadSchedulerUsers fetches all users with agent_enabled=true.
func loadSchedulerUsers(ctx context.Context, db *sql.DB) ([]SchedulerUser, error) {
	rows, err := db.QueryContext(ctx, `
		SELECT user_id, timezone, wake_time, sleep_time,
		       last_evening_plan, last_morning_plan, last_evening_review
		FROM life_profiles
		WHERE agent_enabled = TRUE
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var users []SchedulerUser
	for rows.Next() {
		u, err := scanSchedulerUser(rows)
		if err != nil {
			return nil, err
		}
		users = append(users, u)
	}
	return users, rows.Err()
}

// loadSchedulerUser fetches a single user's scheduler data.
func loadSchedulerUser(ctx context.Context, db *sql.DB, userID string) (*SchedulerUser, error) {
	row := db.QueryRowContext(ctx, `
		SELECT user_id, timezone, wake_time, sleep_time,
		       last_evening_plan, last_morning_plan, last_evening_review
		FROM life_profiles
		WHERE user_id = $1 AND agent_enabled = TRUE
	`, userID)

	var u SchedulerUser
	var tz, wake, sleep sql.NullString
	var lep, lmp, ler sql.NullTime
	if err := row.Scan(&u.UserID, &tz, &wake, &sleep, &lep, &lmp, &ler); err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, fmt.Errorf("scan user: %w", err)
	}
	u.Timezone = tz.String
	u.WakeTime = wake.String
	u.SleepTime = sleep.String
	if lep.Valid {
		u.LastEveningPlan = &lep.Time
	}
	if lmp.Valid {
		u.LastMorningPlan = &lmp.Time
	}
	if ler.Valid {
		u.LastEveningReview = &ler.Time
	}
	return &u, nil
}

func scanSchedulerUser(rows *sql.Rows) (SchedulerUser, error) {
	var u SchedulerUser
	var tz, wake, sleep sql.NullString
	var lep, lmp, ler sql.NullTime
	if err := rows.Scan(&u.UserID, &tz, &wake, &sleep, &lep, &lmp, &ler); err != nil {
		return u, fmt.Errorf("scan user: %w", err)
	}
	u.Timezone = tz.String
	u.WakeTime = wake.String
	u.SleepTime = sleep.String
	if lep.Valid {
		u.LastEveningPlan = &lep.Time
	}
	if lmp.Valid {
		u.LastMorningPlan = &lmp.Time
	}
	if ler.Valid {
		u.LastEveningReview = &ler.Time
	}
	return u, nil
}

// determineDueCycle checks which cycle (if any) is due for a user right now.
func determineDueCycle(user SchedulerUser) PlanCycle {
	loc := time.UTC
	if user.Timezone != "" {
		if l, err := time.LoadLocation(user.Timezone); err == nil {
			loc = l
		}
	}
	now := time.Now().In(loc)

	wakeHour, wakeMin := 7, 0
	sleepHour, sleepMin := 23, 0
	if user.WakeTime != "" {
		fmt.Sscanf(user.WakeTime, "%d:%d", &wakeHour, &wakeMin)
	}
	if user.SleepTime != "" {
		fmt.Sscanf(user.SleepTime, "%d:%d", &sleepHour, &sleepMin)
	}

	nowMins := now.Hour()*60 + now.Minute()
	wakeMins := wakeHour*60 + wakeMin
	sleepMins := sleepHour*60 + sleepMin

	today := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, loc)

	// Morning plan: wakeTime to wakeTime+1h
	if nowMins >= wakeMins && nowMins < wakeMins+60 {
		if !ranToday(user.LastMorningPlan, today) {
			return CycleMorningPlan
		}
	}

	// Evening review: sleepTime-4h to sleepTime-2h
	if nowMins >= sleepMins-240 && nowMins < sleepMins-120 {
		if !ranToday(user.LastEveningReview, today) {
			return CycleEveningReview
		}
	}

	// Evening plan: sleepTime-2h to sleepTime
	if nowMins >= sleepMins-120 && nowMins < sleepMins {
		if !ranToday(user.LastEveningPlan, today) {
			return CycleEveningPlan
		}
	}

	return ""
}

// ranToday returns true if the given timestamp is on or after the start of today.
func ranToday(last *time.Time, today time.Time) bool {
	if last == nil {
		return false
	}
	return !last.Before(today)
}

// runCycleForUser executes a single planning cycle for one user.
func runCycleForUser(ctx context.Context, db *sql.DB, agent *Agent, user SchedulerUser, cycle PlanCycle) error {
	userID := user.UserID

	// ── 1. Find or create scheduler conversation ─────────────────────────
	var convID string
	err := db.QueryRowContext(ctx,
		`SELECT id FROM life_conversations
		 WHERE user_id = $1 AND channel = 'scheduler'
		 ORDER BY updated_at DESC LIMIT 1`,
		userID,
	).Scan(&convID)
	if err != nil && err != sql.ErrNoRows {
		return fmt.Errorf("look up scheduler conversation: %w", err)
	}
	if convID == "" {
		convID = uuid.NewString()
		if _, err := db.ExecContext(ctx,
			`INSERT INTO life_conversations (id, user_id, channel, title)
			 VALUES ($1, $2, 'scheduler', 'Daily Planning')`,
			convID, userID,
		); err != nil {
			return fmt.Errorf("create scheduler conversation: %w", err)
		}
	}

	// ── 2. No history — each cycle starts fresh to avoid stale context ───
	var history []Message

	// ── 3. Load memories ─────────────────────────────────────────────────
	memRows, err := db.QueryContext(ctx,
		`SELECT id, category, content FROM life_memories
		 WHERE user_id = $1 AND active = TRUE
		 ORDER BY created_at DESC`,
		userID,
	)
	if err != nil {
		return fmt.Errorf("load memories: %w", err)
	}
	var memories []Memory
	for memRows.Next() {
		var m Memory
		if err := memRows.Scan(&m.ID, &m.Category, &m.Content); err != nil {
			memRows.Close()
			return fmt.Errorf("scan memory: %w", err)
		}
		memories = append(memories, m)
	}
	memRows.Close()

	// ── 4. Load profile ──────────────────────────────────────────────────
	var profile Profile
	var wakeTime, sleepTime sql.NullString
	if err := db.QueryRowContext(ctx,
		`SELECT timezone, wake_time, sleep_time FROM life_profiles WHERE user_id = $1`,
		userID,
	).Scan(&profile.Timezone, &wakeTime, &sleepTime); err != nil && err != sql.ErrNoRows {
		log.Printf("scheduler: load profile for %s: %v", userID, err)
	}
	if wakeTime.Valid {
		profile.WakeTime = wakeTime.String
	}
	if sleepTime.Valid {
		profile.SleepTime = sleepTime.String
	}

	// ── 5. Load routines ─────────────────────────────────────────────────
	routineRows, err := db.QueryContext(ctx,
		`SELECT id, name, type, description FROM life_routines
		 WHERE user_id = $1 AND active = TRUE
		 ORDER BY created_at DESC`,
		userID,
	)
	if err != nil {
		return fmt.Errorf("load routines: %w", err)
	}
	var routines []Routine
	for routineRows.Next() {
		var rt Routine
		if err := routineRows.Scan(&rt.ID, &rt.Name, &rt.Type, &rt.Description); err != nil {
			routineRows.Close()
			return fmt.Errorf("scan routine: %w", err)
		}
		routines = append(routines, rt)
	}
	routineRows.Close()

	// ── 5b. Load routine-event links ────────────────────────────────────
	routineEventLinks := make(map[string][]string)
	if len(routines) > 0 {
		linkRows, err := db.QueryContext(ctx, `
			SELECT rel.routine_id, lge.summary
			FROM life_routine_event_links rel
			JOIN life_gcal_events lge ON lge.id = rel.gcal_event_id AND lge.user_id = rel.user_id
			WHERE rel.user_id = $1`,
			userID)
		if err == nil {
			for linkRows.Next() {
				var rid, summary string
				if err := linkRows.Scan(&rid, &summary); err == nil && summary != "" {
					routineEventLinks[rid] = append(routineEventLinks[rid], summary)
				}
			}
			linkRows.Close()
		}
	}

	// ── 6. Count pending actionables ─────────────────────────────────────
	var pendingCount int
	_ = db.QueryRowContext(ctx,
		`SELECT COUNT(*) FROM life_actionables WHERE user_id = $1 AND status = 'pending'`,
		userID,
	).Scan(&pendingCount)

	// ── 7. Load calendar events (best-effort) ────────────────────────────
	var calendarEvents []GCalEvent
	if gcalCli := agent.GCalClient(); gcalCli != nil {
		if token, err := EnsureValidToken(ctx, db, gcalCli, userID); err == nil {
			if evs, err := gcalCli.ListEvents(ctx, token, 3); err == nil {
				calendarEvents = evs
			}
		}
	}

	// ── 8. Build cycle prompt ────────────────────────────────────────────
	prompt := schedulerPrompt(cycle, user)

	// ── 9. Save the scheduler prompt as a user message ───────────────────
	userMsgID := uuid.NewString()
	if _, err := db.ExecContext(ctx,
		`INSERT INTO life_messages (id, conversation_id, user_id, role, content, channel)
		 VALUES ($1, $2, $3, 'user', $4, 'scheduler')`,
		userMsgID, convID, userID, prompt,
	); err != nil {
		return fmt.Errorf("save scheduler prompt: %w", err)
	}

	// ── 10. Call the agent ───────────────────────────────────────────────
	systemCtx := fmt.Sprintf(`This is an automated scheduler cycle (%s). You are a background planning agent.

CRITICAL: You MUST call the create_actionable tool. The user will NEVER see your text responses — only actionables appear in their UI. If you respond with text only, the user sees NOTHING.

Rules:
- Call create_actionable for every item. Use type "info" for briefings, "confirm" for yes/no, "choose" for options, "input" for questions.
- Optionally add template and data fields for rich display (template: daily_plan, routine_check, suggestion, etc.)
- Aim for 3-6 actionables per cycle. Be specific to the user's actual data.
- The user has %d pending actionable(s). Don't duplicate.
- ALWAYS use tools. NEVER respond with just text.`, cycle, pendingCount)

	chatResult, err := agent.Chat(ctx, ChatRequest{
		UserID:                  userID,
		Message:                 prompt,
		History:                 history,
		Memories:                memories,
		Profile:                 &profile,
		Routines:                routines,
		PendingActionablesCount: pendingCount,
		CalendarEvents:          calendarEvents,
		RoutineEventLinks:       routineEventLinks,
		AutoApprove:             true,
		SystemContext:           systemCtx,
	})
	if err != nil {
		return fmt.Errorf("agent chat: %w", err)
	}

	log.Printf("scheduler: agent response for %s/%s — %d effects, text: %s",
		userID, cycle, len(chatResult.Effects), truncate(chatResult.Text, 500))

	// ── 11. Save assistant response ──────────────────────────────────────
	var effects []map[string]any
	for _, eff := range chatResult.Effects {
		item := map[string]any{
			"tool": eff.Tool,
			"id":   eff.ID,
		}
		var parsed map[string]any
		if json.Unmarshal([]byte(eff.Result), &parsed) == nil {
			item["data"] = parsed
		}
		effects = append(effects, item)
	}
	var toolCallsJSON []byte
	if len(effects) > 0 {
		toolCallsJSON, _ = json.Marshal(effects)
	}

	assistantMsgID := uuid.NewString()
	if _, err := db.ExecContext(ctx,
		`INSERT INTO life_messages (id, conversation_id, user_id, role, content, channel, tool_calls)
		 VALUES ($1, $2, $3, 'assistant', $4, 'scheduler', $5)`,
		assistantMsgID, convID, userID, chatResult.Text,
		func() any {
			if len(toolCallsJSON) > 0 {
				return string(toolCallsJSON)
			}
			return nil
		}(),
	); err != nil {
		return fmt.Errorf("save assistant response: %w", err)
	}

	// ── 12. Bump conversation updated_at ─────────────────────────────────
	_, _ = db.ExecContext(ctx,
		`UPDATE life_conversations SET updated_at = NOW() WHERE id = $1`, convID)

	// ── 13. Update tracking timestamp ────────────────────────────────────
	var col string
	switch cycle {
	case CycleEveningPlan:
		col = "last_evening_plan"
	case CycleMorningPlan:
		col = "last_morning_plan"
	case CycleEveningReview:
		col = "last_evening_review"
	}
	if _, err := db.ExecContext(ctx,
		fmt.Sprintf(`UPDATE life_profiles SET %s = NOW() WHERE user_id = $1`, col),
		userID,
	); err != nil {
		log.Printf("scheduler: update %s for %s: %v", col, userID, err)
	}

	log.Printf("scheduler: completed %s for user %s — %d effects", cycle, userID, len(chatResult.Effects))
	return nil
}

func truncate(s string, max int) string {
	if len(s) <= max {
		return s
	}
	return s[:max] + "..."
}

// schedulerPrompt builds the cycle-specific prompt sent to the agent.
func schedulerPrompt(cycle PlanCycle, user SchedulerUser) string {
	loc := time.UTC
	if user.Timezone != "" {
		if l, err := time.LoadLocation(user.Timezone); err == nil {
			loc = l
		}
	}
	now := time.Now().In(loc)
	tomorrow := now.AddDate(0, 0, 1)

	switch cycle {
	case CycleEveningPlan:
		return fmt.Sprintf(`It's %s evening. Plan tomorrow (%s) for the user.

Review their calendar events, routines, and tasks for tomorrow. Then create actionables asking about their preferences and plans:

1. Check if any routines are scheduled for tomorrow and create relevant preference questions (e.g., gym workout type, meal choices, who to call).
2. Look at tomorrow's calendar events and create reminders or preparation actionables.
3. If the user has incomplete tasks due soon, ask about priorities.
4. Create a "choose" actionable if there are schedule decisions to make.
5. Create an "input" actionable asking if there's anything special they want to plan for tomorrow.

Be specific to their actual routines and events — don't make up generic suggestions.`,
			now.Format("Monday"), tomorrow.Format("Tuesday, January 2"))

	case CycleMorningPlan:
		return fmt.Sprintf(`Good morning! It's %s. Create a morning briefing for the user.

1. Create an "info" actionable summarizing today's schedule — calendar events, routines due, and pending tasks.
2. If they responded to yesterday's evening plan actionables, incorporate those preferences.
3. Create any "confirm" actionables for things that need a decision today.
4. If they have a morning routine, create an encouraging "info" actionable about it.
5. Mention the weather context if relevant (based on their timezone/location from memories).

Keep it upbeat but practical. This is the first thing they see when they check the app.`,
			now.Format("Monday, January 2"))

	case CycleEveningReview:
		return fmt.Sprintf(`It's %s evening. Time for a daily review.

1. Check which routines were scheduled for today and create "confirm" actionables asking if the user completed them.
2. Look at today's calendar events and ask if anything noteworthy happened.
3. Check if there are incomplete tasks and ask about progress.
4. Create an "input" actionable asking: "What went well today? Anything you'd change?"
5. If applicable, note any streaks or patterns (based on memories).

This helps the user reflect and helps you plan better for tomorrow.`,
			now.Format("Monday, January 2"))

	default:
		return "Run a general planning check for the user."
	}
}
