package life

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/tmc/langchaingo/llms"
)

// toolDefs returns the full list of tool definitions the agent can call.
func toolDefs() []llms.Tool {
	return []llms.Tool{
		{
			Type: "function",
			Function: &llms.FunctionDefinition{
				Name:        "create_actionable",
				Description: "Create an actionable item that surfaces to the user for a decision or acknowledgement.",
				Parameters: map[string]any{
					"type": "object",
					"properties": map[string]any{
						"type": map[string]any{
							"type":        "string",
							"enum":        []string{"confirm", "choose", "input", "info"},
							"description": "confirm = yes/no; choose = pick from options; input = free-text response; info = read-only notice",
						},
						"title": map[string]any{
							"type":        "string",
							"description": "Short headline (max ~80 chars)",
						},
						"description": map[string]any{
							"type":        "string",
							"description": "Explanation shown to the user",
						},
						"template": map[string]any{
							"type":        "string",
							"enum":        []string{"daily_plan", "daily_review", "routine_check", "meal_choice", "schedule_pick", "reminder", "preference", "task_roundup", "streak", "suggestion"},
							"description": "Optional visual template for rich display",
						},
						"data": map[string]any{
							"type":        "object",
							"description": "Optional structured data for the template",
						},
						"options": map[string]any{
							"type":        "array",
							"description": "Required for type=choose. List of choices.",
							"items": map[string]any{
								"type": "object",
								"properties": map[string]any{
									"id":     map[string]any{"type": "string"},
									"label":  map[string]any{"type": "string"},
									"detail": map[string]any{"type": "string"},
								},
								"required": []string{"id", "label"},
							},
						},
						"due_at": map[string]any{
							"type":        "string",
							"description": "Optional ISO-8601 deadline",
						},
						"action_type": map[string]any{
							"type":        "string",
							"enum":        []string{"create_routine", "create_memory", "create_calendar_event", "delete_calendar_event", "create_task", "none"},
							"description": "Deferred action to execute when the user confirms.",
						},
						"action_payload": map[string]any{
							"type":        "object",
							"description": "Data for the deferred action.",
						},
					},
					"required": []string{"type", "title"},
				},
			},
		},
		{
			Type: "function",
			Function: &llms.FunctionDefinition{
				Name:        "remember",
				Description: "Store a new fact, preference, instruction, or habit about the user for future context.",
				Parameters: map[string]any{
					"type": "object",
					"properties": map[string]any{
						"content": map[string]any{
							"type":        "string",
							"description": "The fact or preference to remember",
						},
						"category": map[string]any{
							"type":        "string",
							"enum":        []string{"preference", "instruction", "fact", "habit"},
							"description": "Category for organising the memory",
						},
					},
					"required": []string{"content"},
				},
			},
		},
		{
			Type: "function",
			Function: &llms.FunctionDefinition{
				Name:        "forget",
				Description: "Remove a memory that is no longer accurate or relevant.",
				Parameters: map[string]any{
					"type": "object",
					"properties": map[string]any{
						"memory_id": map[string]any{
							"type":        "string",
							"description": "The ID of the memory to delete (soft-delete)",
						},
					},
					"required": []string{"memory_id"},
				},
			},
		},
		{
			Type: "function",
			Function: &llms.FunctionDefinition{
				Name:        "create_routine",
				Description: "Create a new recurring routine. Only use when you have HIGH confidence the user wants this tracked. For medium confidence, create a confirm actionable instead.",
				Parameters: map[string]any{
					"type": "object",
					"properties": map[string]any{
						"name": map[string]any{
							"type":        "string",
							"description": "Human-readable name (e.g. 'Morning Gym', 'Call Family', 'Evening Reading')",
						},
						"type": map[string]any{
							"type":        "string",
							"enum":        []string{"call_loved_ones", "gym", "reading", "morning_routine", "evening_routine", "weekly_review", "habit_tracker", "custom"},
							"description": "Routine category",
						},
						"description": map[string]any{
							"type":        "string",
							"description": "What this routine involves",
						},
						"schedule": map[string]any{
							"type":        "object",
							"description": `When the routine occurs. Format: {"frequency": "daily"|"weekly"|"every_n_days", "interval": 2, "days": [1,3,5], "time": "09:00"}. days: 0=Sun..6=Sat.`,
							"properties": map[string]any{
								"frequency": map[string]any{"type": "string", "enum": []string{"daily", "weekly", "every_n_days"}},
								"interval":  map[string]any{"type": "integer", "description": "For every_n_days: repeat every N days"},
								"days":      map[string]any{"type": "array", "items": map[string]any{"type": "integer"}, "description": "For weekly: which days (0=Sun..6=Sat)"},
								"time":      map[string]any{"type": "string", "description": "Preferred time in HH:MM format"},
							},
						},
						"config": map[string]any{
							"type":        "object",
							"description": `Type-specific data. Examples: call_loved_ones: {"contacts":[{"name":"Mom","frequency":"every_other_day"}]}; gym: {"variations":[{"day":"monday","workout":"legs"}]}; reading: {"books":[{"title":"...","status":"reading"}]}`,
						},
					},
					"required": []string{"name", "type"},
				},
			},
		},
		{
			Type: "function",
			Function: &llms.FunctionDefinition{
				Name:        "update_routine",
				Description: "Update an existing routine. Use this instead of creating a new one when the user wants to modify a routine. Call list_routines first to get the routine ID.",
				Parameters: map[string]any{
					"type": "object",
					"properties": map[string]any{
						"routine_id": map[string]any{
							"type":        "string",
							"description": "ID of the routine to update",
						},
						"name": map[string]any{
							"type":        "string",
							"description": "New name (optional, only if changing)",
						},
						"description": map[string]any{
							"type":        "string",
							"description": "New description (optional)",
						},
						"schedule": map[string]any{
							"type":        "object",
							"description": "New schedule (optional, replaces existing)",
						},
						"config": map[string]any{
							"type":        "object",
							"description": "New config (optional, replaces existing)",
						},
						"active": map[string]any{
							"type":        "boolean",
							"description": "Set to false to deactivate the routine",
						},
					},
					"required": []string{"routine_id"},
				},
			},
		},
		{
			Type: "function",
			Function: &llms.FunctionDefinition{
				Name:        "delete_routine",
				Description: "Deactivate (soft-delete) a routine. Call list_routines first to get the routine ID.",
				Parameters: map[string]any{
					"type": "object",
					"properties": map[string]any{
						"routine_id": map[string]any{
							"type":        "string",
							"description": "ID of the routine to delete",
						},
					},
					"required": []string{"routine_id"},
				},
			},
		},
		{
			Type: "function",
			Function: &llms.FunctionDefinition{
				Name:        "list_routines",
				Description: "Retrieve the user's active routines with their IDs. Always call this before updating or deleting a routine.",
				Parameters: map[string]any{
					"type":       "object",
					"properties": map[string]any{},
				},
			},
		},
		{
			Type: "function",
			Function: &llms.FunctionDefinition{
				Name:        "list_actionables",
				Description: "Retrieve the user's actionables, optionally filtered by status.",
				Parameters: map[string]any{
					"type": "object",
					"properties": map[string]any{
						"status": map[string]any{
							"type":        "string",
							"enum":        []string{"pending", "confirmed", "dismissed", "snoozed"},
							"description": "Filter by status. Defaults to pending.",
						},
					},
				},
			},
		},
		{
			Type: "function",
			Function: &llms.FunctionDefinition{
				Name:        "get_calendar_events",
				Description: "Fetch upcoming events from the user's connected Google Calendar.",
				Parameters: map[string]any{
					"type": "object",
					"properties": map[string]any{
						"days_ahead": map[string]any{
							"type":        "integer",
							"description": "How many days ahead to fetch events. Defaults to 7.",
						},
					},
				},
			},
		},
		{
			Type: "function",
			Function: &llms.FunctionDefinition{
				Name:        "create_calendar_event",
				Description: "Create a new event on the user's Google Calendar.",
				Parameters: map[string]any{
				"type": "object",
				"properties": map[string]any{
					"summary": map[string]any{
						"type":        "string",
						"description": "Event title",
					},
					"start": map[string]any{
						"type":        "string",
						"description": "Start time in RFC3339 format (e.g. 2026-03-24T09:00:00Z)",
					},
					"end": map[string]any{
						"type":        "string",
						"description": "End time in RFC3339 format",
					},
					"description": map[string]any{
						"type":        "string",
						"description": "Optional event description",
					},
					"location": map[string]any{
						"type":        "string",
						"description": "Optional event location",
					},
					"routine_id": map[string]any{
						"type":        "string",
						"description": "Optional: link this event to a routine by its ID",
					},
					"recurrence": map[string]any{
						"type":        "array",
						"description": `Optional: RRULE strings for recurring events, e.g. ["RRULE:FREQ=WEEKLY;BYDAY=MO"]`,
						"items":       map[string]any{"type": "string"},
					},
				},
				"required": []string{"summary", "start", "end"},
			},
		},
	},
	{
		Type: "function",
		Function: &llms.FunctionDefinition{
			Name:        "link_event_to_routine",
			Description: "Link an existing Google Calendar event to a routine. Use when a calendar event corresponds to a routine.",
			Parameters: map[string]any{
				"type": "object",
				"properties": map[string]any{
					"event_id":   map[string]any{"type": "string", "description": "Google Calendar event ID"},
					"routine_id": map[string]any{"type": "string", "description": "Routine ID to link to"},
				},
				"required": []string{"event_id", "routine_id"},
			},
		},
	},
	{
		Type: "function",
		Function: &llms.FunctionDefinition{
			Name:        "update_calendar_event",
			Description: "Update an existing event on the user's Google Calendar. Call get_calendar_events first to get event IDs.",
			Parameters: map[string]any{
				"type": "object",
				"properties": map[string]any{
					"event_id":    map[string]any{"type": "string", "description": "The event ID to update"},
					"summary":     map[string]any{"type": "string", "description": "New title (optional)"},
					"start":       map[string]any{"type": "string", "description": "New start time RFC3339 (optional)"},
					"end":         map[string]any{"type": "string", "description": "New end time RFC3339 (optional)"},
					"description": map[string]any{"type": "string", "description": "New description (optional)"},
					"location":    map[string]any{"type": "string", "description": "New location (optional)"},
				},
				"required": []string{"event_id"},
			},
		},
	},
	{
		Type: "function",
		Function: &llms.FunctionDefinition{
			Name:        "delete_calendar_event",
			Description: "Delete an event from the user's Google Calendar. Call get_calendar_events first to get event IDs.",
			Parameters: map[string]any{
				"type": "object",
				"properties": map[string]any{
					"event_id": map[string]any{"type": "string", "description": "The event ID to delete"},
				},
				"required": []string{"event_id"},
			},
		},
	},
	// ── Google Tasks ──────────────────────────────────────────────────────
	{
		Type: "function",
		Function: &llms.FunctionDefinition{
			Name:        "list_tasks",
			Description: "List tasks from the user's Google Tasks. Returns pending tasks by default.",
			Parameters: map[string]any{
				"type": "object",
				"properties": map[string]any{
					"list_id": map[string]any{
						"type":        "string",
						"description": "Task list ID. Omit to use the default list.",
					},
					"show_completed": map[string]any{
						"type":        "boolean",
						"description": "Include completed tasks. Defaults to false.",
					},
				},
			},
		},
	},
	{
		Type: "function",
		Function: &llms.FunctionDefinition{
			Name:        "create_task",
			Description: "Create a new task in Google Tasks.",
			Parameters: map[string]any{
				"type": "object",
				"properties": map[string]any{
					"title":   map[string]any{"type": "string", "description": "Task title"},
					"notes":   map[string]any{"type": "string", "description": "Optional notes"},
					"due":     map[string]any{"type": "string", "description": "Due date in YYYY-MM-DD format"},
					"list_id": map[string]any{"type": "string", "description": "Task list ID. Omit for default."},
				},
				"required": []string{"title"},
			},
		},
	},
	{
		Type: "function",
		Function: &llms.FunctionDefinition{
			Name:        "complete_task",
			Description: "Mark a Google Task as completed.",
			Parameters: map[string]any{
				"type": "object",
				"properties": map[string]any{
					"task_id": map[string]any{"type": "string", "description": "The task ID"},
					"list_id": map[string]any{"type": "string", "description": "Task list ID. Omit for default."},
				},
				"required": []string{"task_id"},
			},
		},
	},
	{
		Type: "function",
		Function: &llms.FunctionDefinition{
			Name:        "update_task",
			Description: "Update a Google Task's title, notes, due date, or status.",
			Parameters: map[string]any{
				"type": "object",
				"properties": map[string]any{
					"task_id": map[string]any{"type": "string", "description": "The task ID"},
					"title":   map[string]any{"type": "string", "description": "New title"},
					"notes":   map[string]any{"type": "string", "description": "New notes"},
					"due":     map[string]any{"type": "string", "description": "Due date YYYY-MM-DD"},
					"status":  map[string]any{"type": "string", "enum": []string{"needsAction", "completed"}},
					"list_id": map[string]any{"type": "string", "description": "Task list ID. Omit for default."},
				},
				"required": []string{"task_id"},
			},
		},
	},
	{
		Type: "function",
		Function: &llms.FunctionDefinition{
			Name:        "delete_task",
			Description: "Permanently delete a Google Task.",
			Parameters: map[string]any{
				"type": "object",
				"properties": map[string]any{
					"task_id": map[string]any{"type": "string", "description": "The task ID"},
					"list_id": map[string]any{"type": "string", "description": "Task list ID. Omit for default."},
				},
				"required": []string{"task_id"},
			},
		},
	},
	{
		Type: "function",
		Function: &llms.FunctionDefinition{
			Name:        "create_task_list",
			Description: "Create a new Google Tasks list.",
			Parameters: map[string]any{
				"type": "object",
				"properties": map[string]any{
					"title": map[string]any{"type": "string", "description": "Name of the new task list"},
				},
				"required": []string{"title"},
			},
		},
	},
	}
}

// toolsRequiringApproval are tools that create/modify/delete resources.
// When autoApprove is false, calls to these tools are intercepted and
// converted to confirm-type actionables automatically.
var toolsRequiringApproval = map[string]string{
	"create_routine":         "create_routine",
	"update_routine":         "update_routine",
	"delete_routine":         "delete_routine",
	"create_calendar_event":  "create_calendar_event",
	"update_calendar_event":  "update_calendar_event",
	"delete_calendar_event":  "delete_calendar_event",
	"create_task":            "create_task",
	"update_task":            "update_task",
	"delete_task":            "delete_task",
	"complete_task":          "complete_task",
	"create_task_list":       "create_task_list",
}

// toolActionTitle generates a human-readable title for an intercepted tool call.
func toolActionTitle(toolName string, args map[string]any) string {
	name, _ := args["name"].(string)
	title, _ := args["title"].(string)
	summary, _ := args["summary"].(string)
	label := name
	if label == "" { label = title }
	if label == "" { label = summary }

	switch toolName {
	case "create_routine":
		if label != "" { return fmt.Sprintf("Create routine: %s?", label) }
		return "Create a new routine?"
	case "create_calendar_event":
		if label != "" { return fmt.Sprintf("Add to calendar: %s?", label) }
		return "Add event to calendar?"
	case "create_task":
		if label != "" { return fmt.Sprintf("Add task: %s?", label) }
		return "Add a new task?"
	case "delete_calendar_event":
		return "Delete calendar event?"
	case "update_routine":
		if label != "" { return fmt.Sprintf("Update routine: %s?", label) }
		return "Update routine?"
	case "delete_routine":
		return "Delete routine?"
	case "update_task":
		if label != "" { return fmt.Sprintf("Update task: %s?", label) }
		return "Update task?"
	case "delete_task":
		return "Delete task?"
	case "complete_task":
		return "Complete task?"
	case "create_task_list":
		if label != "" { return fmt.Sprintf("Create task list: %s?", label) }
		return "Create a new task list?"
	default:
		return "Approve action?"
	}
}

// executeTool dispatches a single tool call to the appropriate DB operation and
// returns a JSON string result (always valid JSON).
// When autoApprove is false, write operations are intercepted and converted to
// confirm-type actionables so the user must approve them.
func executeTool(ctx context.Context, db *sql.DB, gcalClient *GCalClient, userID string, autoApprove bool, call llms.ToolCall) string {
	var args map[string]any
	if err := json.Unmarshal([]byte(call.FunctionCall.Arguments), &args); err != nil {
		return jsonError("invalid arguments: " + err.Error())
	}

	// Intercept write tools when auto-approve is off — convert to actionable.
	if !autoApprove {
		if actionType, needsApproval := toolsRequiringApproval[call.FunctionCall.Name]; needsApproval {
			log.Printf("life agent: intercepting %q → creating actionable (auto-approve off)", call.FunctionCall.Name)
			title := toolActionTitle(call.FunctionCall.Name, args)
			actionableArgs := map[string]any{
				"type":           "confirm",
				"title":          title,
				"action_type":    actionType,
				"action_payload": args,
			}
			return toolCreateActionable(ctx, db, userID, actionableArgs)
		}
	}

	switch call.FunctionCall.Name {
	case "create_actionable":
		return toolCreateActionable(ctx, db, userID, args)
	case "remember":
		return toolRemember(ctx, db, userID, args)
	case "forget":
		return toolForget(ctx, db, userID, args)
	case "create_routine":
		return toolCreateRoutine(ctx, db, userID, args)
	case "update_routine":
		return toolUpdateRoutine(ctx, db, userID, args)
	case "delete_routine":
		return toolDeleteRoutine(ctx, db, userID, args)
	case "list_routines":
		return toolListRoutines(ctx, db, userID)
	case "list_actionables":
		return toolListActionables(ctx, db, userID, args)
	case "get_calendar_events":
		return toolGetCalendarEvents(ctx, db, gcalClient, userID, args)
	case "create_calendar_event":
		return toolCreateCalendarEvent(ctx, db, gcalClient, userID, args)
	case "update_calendar_event":
		return toolUpdateCalendarEvent(ctx, db, gcalClient, userID, args)
	case "delete_calendar_event":
		return toolDeleteCalendarEvent(ctx, db, gcalClient, userID, args)
	case "link_event_to_routine":
		return toolLinkEventToRoutine(ctx, db, gcalClient, userID, args)
	case "list_tasks":
		return toolListTasks(ctx, db, gcalClient, userID, args)
	case "create_task":
		return toolCreateTask(ctx, db, gcalClient, userID, args)
	case "complete_task":
		return toolCompleteTask(ctx, db, gcalClient, userID, args)
	case "update_task":
		return toolUpdateTask(ctx, db, gcalClient, userID, args)
	case "delete_task":
		return toolDeleteTask(ctx, db, gcalClient, userID, args)
	case "create_task_list":
		return toolCreateTaskList(ctx, db, gcalClient, userID, args)
	default:
		return jsonError("unknown tool: " + call.FunctionCall.Name)
	}
}

// ----- individual tool implementations -----

func toolCreateActionable(ctx context.Context, db *sql.DB, userID string, args map[string]any) string {
	log.Printf("life agent: toolCreateActionable called with args: %v", args)
	aType, _ := args["type"].(string)
	if aType == "" {
		aType = "info"
	}
	title, _ := args["title"].(string)
	if title == "" {
		return jsonError("title is required")
	}
	description, _ := args["description"].(string)

	// options JSONB
	var optionsJSON []byte
	if opts, ok := args["options"]; ok && opts != nil {
		b, err := json.Marshal(opts)
		if err != nil {
			return jsonError("failed to encode options: " + err.Error())
		}
		optionsJSON = b
	}

	// due_at
	var dueAt *time.Time
	if dueStr, ok := args["due_at"].(string); ok && dueStr != "" {
		if t, err := time.Parse(time.RFC3339, dueStr); err == nil {
			dueAt = &t
		}
	}

	// action_type + action_payload
	actionType, _ := args["action_type"].(string)

	// Build action_payload: merge deferred payload + template + data
	payloadMap := map[string]any{}
	if ap, ok := args["action_payload"].(map[string]any); ok {
		for k, v := range ap {
			payloadMap[k] = v
		}
	}
	if tpl, ok := args["template"].(string); ok && tpl != "" {
		payloadMap["template"] = tpl
	}
	if data, ok := args["data"].(map[string]any); ok {
		payloadMap["data"] = data
	}
	var actionPayloadJSON []byte
	if len(payloadMap) > 0 {
		b, err := json.Marshal(payloadMap)
		if err != nil {
			return jsonError("failed to encode action_payload: " + err.Error())
		}
		actionPayloadJSON = b
	}

	id := uuid.NewString()
	const q = `
		INSERT INTO life_actionables
			(id, user_id, type, status, title, description, options, due_at, action_type, action_payload)
		VALUES ($1, $2, $3, 'pending', $4, $5, $6, $7, $8, $9)
		RETURNING id, created_at`

	var createdAt time.Time
	err := db.QueryRowContext(ctx, q,
		id, userID, aType, title, description,
		nullableJSON(optionsJSON), dueAt, actionType, nullableJSON(actionPayloadJSON),
	).Scan(&id, &createdAt)
	if err != nil {
		return jsonError("failed to create actionable: " + err.Error())
	}

	return jsonOK(map[string]any{
		"actionable_id": id,
		"created_at":    createdAt.UTC().Format(time.RFC3339),
	})
}

func toolRemember(ctx context.Context, db *sql.DB, userID string, args map[string]any) string {
	content, _ := args["content"].(string)
	if content == "" {
		return jsonError("content is required")
	}
	category, _ := args["category"].(string)
	if category == "" {
		category = "fact"
	}

	id := uuid.NewString()
	const q = `
		INSERT INTO life_memories (id, user_id, category, content, source)
		VALUES ($1, $2, $3, $4, 'agent')
		RETURNING id`

	var returnedID string
	if err := db.QueryRowContext(ctx, q, id, userID, category, content).Scan(&returnedID); err != nil {
		return jsonError("failed to store memory: " + err.Error())
	}

	return jsonOK(map[string]any{"memory_id": returnedID, "content": content, "category": category})
}

func toolForget(ctx context.Context, db *sql.DB, userID string, args map[string]any) string {
	memoryID, _ := args["memory_id"].(string)
	if memoryID == "" {
		return jsonError("memory_id is required")
	}

	res, err := db.ExecContext(ctx,
		`UPDATE life_memories SET active = FALSE, updated_at = NOW()
		 WHERE id = $1 AND user_id = $2`,
		memoryID, userID,
	)
	if err != nil {
		return jsonError("failed to forget memory: " + err.Error())
	}
	n, _ := res.RowsAffected()
	if n == 0 {
		return jsonError("memory not found")
	}

	return jsonOK(map[string]any{"forgotten": true})
}

func toolCreateRoutine(ctx context.Context, db *sql.DB, userID string, args map[string]any) string {
	name, _ := args["name"].(string)
	if name == "" {
		return jsonError("name is required")
	}
	rType, _ := args["type"].(string)
	if rType == "" {
		return jsonError("type is required")
	}
	description, _ := args["description"].(string)

	scheduleJSON := []byte("{}")
	if sched, ok := args["schedule"]; ok && sched != nil {
		b, err := json.Marshal(sched)
		if err != nil {
			return jsonError("failed to encode schedule: " + err.Error())
		}
		scheduleJSON = b
	}

	configJSON := []byte("{}")
	if cfg, ok := args["config"]; ok && cfg != nil {
		b, err := json.Marshal(cfg)
		if err != nil {
			return jsonError("failed to encode config: " + err.Error())
		}
		configJSON = b
	}

	id := uuid.NewString()
	const q = `
		INSERT INTO life_routines (id, user_id, name, type, description, schedule, config)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
		RETURNING id, created_at`

	var createdAt time.Time
	if err := db.QueryRowContext(ctx, q,
		id, userID, name, rType, description, string(scheduleJSON), string(configJSON),
	).Scan(&id, &createdAt); err != nil {
		return jsonError("failed to create routine: " + err.Error())
	}

	return jsonOK(map[string]any{
		"routine_id":  id,
		"name":        name,
		"type":        rType,
		"description": description,
		"created_at":  createdAt.UTC().Format(time.RFC3339),
	})
}

func toolUpdateRoutine(ctx context.Context, db *sql.DB, userID string, args map[string]any) string {
	routineID, _ := args["routine_id"].(string)
	if routineID == "" {
		return jsonError("routine_id is required")
	}

	// Verify ownership.
	var ownerID string
	if err := db.QueryRowContext(ctx,
		`SELECT user_id FROM life_routines WHERE id = $1 AND active = TRUE`, routineID,
	).Scan(&ownerID); err != nil {
		return jsonError("routine not found")
	}
	if ownerID != userID {
		return jsonError("routine not found")
	}

	// Build dynamic SET clauses.
	sets := []string{"updated_at = NOW()"}
	params := []any{}
	paramIdx := 1

	if name, ok := args["name"].(string); ok && name != "" {
		sets = append(sets, fmt.Sprintf("name = $%d", paramIdx))
		params = append(params, name)
		paramIdx++
	}
	if desc, ok := args["description"].(string); ok {
		sets = append(sets, fmt.Sprintf("description = $%d", paramIdx))
		params = append(params, desc)
		paramIdx++
	}
	if sched, ok := args["schedule"]; ok && sched != nil {
		b, err := json.Marshal(sched)
		if err != nil {
			return jsonError("failed to encode schedule: " + err.Error())
		}
		sets = append(sets, fmt.Sprintf("schedule = $%d", paramIdx))
		params = append(params, string(b))
		paramIdx++
	}
	if cfg, ok := args["config"]; ok && cfg != nil {
		b, err := json.Marshal(cfg)
		if err != nil {
			return jsonError("failed to encode config: " + err.Error())
		}
		sets = append(sets, fmt.Sprintf("config = $%d", paramIdx))
		params = append(params, string(b))
		paramIdx++
	}
	if active, ok := args["active"].(bool); ok {
		sets = append(sets, fmt.Sprintf("active = $%d", paramIdx))
		params = append(params, active)
		paramIdx++
	}

	if len(params) == 0 {
		return jsonOK(map[string]any{"routine_id": routineID, "message": "no changes"})
	}

	params = append(params, routineID, userID)
	q := fmt.Sprintf(
		"UPDATE life_routines SET %s WHERE id = $%d AND user_id = $%d",
		strings.Join(sets, ", "), paramIdx, paramIdx+1,
	)

	if _, err := db.ExecContext(ctx, q, params...); err != nil {
		return jsonError("failed to update routine: " + err.Error())
	}

	return jsonOK(map[string]any{"routine_id": routineID, "updated": true})
}

func toolDeleteRoutine(ctx context.Context, db *sql.DB, userID string, args map[string]any) string {
	routineID, _ := args["routine_id"].(string)
	if routineID == "" {
		return jsonError("routine_id is required")
	}

	result, err := db.ExecContext(ctx,
		`UPDATE life_routines SET active = FALSE, updated_at = NOW() WHERE id = $1 AND user_id = $2 AND active = TRUE`,
		routineID, userID,
	)
	if err != nil {
		return jsonError("failed to delete routine: " + err.Error())
	}
	rows, _ := result.RowsAffected()
	if rows == 0 {
		return jsonError("routine not found")
	}
	return jsonOK(map[string]any{"routine_id": routineID, "deleted": true})
}

func toolListRoutines(ctx context.Context, db *sql.DB, userID string) string {
	const q = `
		SELECT id, name, type, description, active, created_at
		FROM life_routines
		WHERE user_id = $1 AND active = TRUE
		ORDER BY created_at DESC`

	rows, err := db.QueryContext(ctx, q, userID)
	if err != nil {
		return jsonError("failed to list routines: " + err.Error())
	}
	defer rows.Close()

	type routineRow struct {
		ID          string `json:"id"`
		Name        string `json:"name"`
		Type        string `json:"type"`
		Description string `json:"description"`
		Active      bool   `json:"active"`
		CreatedAt   string `json:"createdAt"`
	}
	list := make([]routineRow, 0)
	for rows.Next() {
		var row routineRow
		var createdAt time.Time
		if err := rows.Scan(&row.ID, &row.Name, &row.Type, &row.Description, &row.Active, &createdAt); err != nil {
			return jsonError("failed to read routine: " + err.Error())
		}
		row.CreatedAt = createdAt.UTC().Format(time.RFC3339)
		list = append(list, row)
	}
	if err := rows.Err(); err != nil {
		return jsonError("failed to iterate routines: " + err.Error())
	}

	return jsonOK(map[string]any{"routines": list})
}

func toolListActionables(ctx context.Context, db *sql.DB, userID string, args map[string]any) string {
	status, _ := args["status"].(string)
	if status == "" {
		status = "pending"
	}

	const q = `
		SELECT id, type, status, title, description, due_at, created_at
		FROM life_actionables
		WHERE user_id = $1 AND status = $2
		ORDER BY created_at DESC
		LIMIT 50`

	rows, err := db.QueryContext(ctx, q, userID, status)
	if err != nil {
		return jsonError("failed to list actionables: " + err.Error())
	}
	defer rows.Close()

	type actionableRow struct {
		ID          string  `json:"id"`
		Type        string  `json:"type"`
		Status      string  `json:"status"`
		Title       string  `json:"title"`
		Description string  `json:"description"`
		DueAt       *string `json:"dueAt,omitempty"`
		CreatedAt   string  `json:"createdAt"`
	}
	list := make([]actionableRow, 0)
	for rows.Next() {
		var row actionableRow
		var dueAt sql.NullTime
		var createdAt time.Time
		if err := rows.Scan(&row.ID, &row.Type, &row.Status, &row.Title, &row.Description, &dueAt, &createdAt); err != nil {
			return jsonError("failed to read actionable: " + err.Error())
		}
		row.CreatedAt = createdAt.UTC().Format(time.RFC3339)
		if dueAt.Valid {
			s := dueAt.Time.UTC().Format(time.RFC3339)
			row.DueAt = &s
		}
		list = append(list, row)
	}
	if err := rows.Err(); err != nil {
		return jsonError("failed to iterate actionables: " + err.Error())
	}

	return jsonOK(map[string]any{"actionables": list, "status": status})
}

func toolGetCalendarEvents(ctx context.Context, db *sql.DB, gcalClient *GCalClient, userID string, args map[string]any) string {
	if gcalClient == nil {
		return jsonError("Google Calendar is not configured")
	}

	daysAhead := 7
	if v, ok := args["days_ahead"]; ok {
		switch n := v.(type) {
		case float64:
			daysAhead = int(n)
		case int:
			daysAhead = n
		}
	}
	if daysAhead <= 0 {
		daysAhead = 7
	}

	// Sync if the cache is stale (15-minute threshold for agent context).
	needs, err := NeedsSync(ctx, db, userID, 15*time.Minute)
	if err != nil {
		// Non-fatal — proceed with whatever is in the cache.
	}
	if needs {
		accessToken, err := EnsureValidToken(ctx, db, gcalClient, userID)
		if err != nil {
			return jsonError("calendar not connected: " + err.Error())
		}
		if _, err := gcalClient.SyncEvents(ctx, db, userID, accessToken); err != nil {
			// Non-fatal — serve from cache.
		}
	}

	now := time.Now()
	events, err := QueryLocalEvents(ctx, db, userID, now, now.AddDate(0, 0, daysAhead))
	if err != nil {
		return jsonError("failed to fetch calendar events: " + err.Error())
	}
	if events == nil {
		events = []GCalEvent{}
	}

	return jsonOK(map[string]any{"events": events, "days_ahead": daysAhead})
}

func toolCreateCalendarEvent(ctx context.Context, db *sql.DB, gcalClient *GCalClient, userID string, args map[string]any) string {
	if gcalClient == nil {
		return jsonError("Google Calendar is not configured")
	}

	summary, _ := args["summary"].(string)
	if summary == "" {
		return jsonError("summary is required")
	}
	startStr, _ := args["start"].(string)
	if startStr == "" {
		return jsonError("start is required")
	}
	endStr, _ := args["end"].(string)
	if endStr == "" {
		return jsonError("end is required")
	}

	startTime, err := time.Parse(time.RFC3339, startStr)
	if err != nil {
		return jsonError("invalid start time (must be RFC3339): " + err.Error())
	}
	endTime, err := time.Parse(time.RFC3339, endStr)
	if err != nil {
		return jsonError("invalid end time (must be RFC3339): " + err.Error())
	}

	description, _ := args["description"].(string)
	location, _ := args["location"].(string)
	routineID, _ := args["routine_id"].(string)
	var recurrence []string
	if recRaw, ok := args["recurrence"]; ok {
		if recArr, ok := recRaw.([]any); ok {
			for _, r := range recArr {
				if s, ok := r.(string); ok {
					recurrence = append(recurrence, s)
				}
			}
		}
	}

	accessToken, err := EnsureValidToken(ctx, db, gcalClient, userID)
	if err != nil {
		return jsonError("calendar not connected: " + err.Error())
	}

	ev, err := gcalClient.CreateEvent(ctx, accessToken, CreateEventRequest{
		Summary:     summary,
		Description: description,
		Location:    location,
		StartTime:   startTime,
		EndTime:     endTime,
		RoutineID:   routineID,
		Recurrence:  recurrence,
	})
	if err != nil {
		return jsonError("failed to create calendar event: " + err.Error())
	}

	// Write-through: insert the created event into local cache.
	_, _ = db.ExecContext(ctx, `
		INSERT INTO life_gcal_events
			(id, user_id, summary, description, location, start_time, end_time, all_day, status, color_id, html_link, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'confirmed', '', $9, NOW())
		ON CONFLICT (user_id, id) DO UPDATE SET
			summary = EXCLUDED.summary, description = EXCLUDED.description,
			location = EXCLUDED.location, start_time = EXCLUDED.start_time,
			end_time = EXCLUDED.end_time, all_day = EXCLUDED.all_day,
			html_link = EXCLUDED.html_link, updated_at = NOW()`,
		ev.ID, userID, ev.Summary, ev.Description, ev.Location,
		ev.Start, ev.End, ev.AllDay, ev.HtmlLink,
	)

	// If a routine was linked, update the cache and create the link record.
	if routineID != "" {
		_, _ = db.ExecContext(ctx, `UPDATE life_gcal_events SET routine_id = $1 WHERE user_id = $2 AND id = $3`,
			routineID, userID, ev.ID)
		_, _ = db.ExecContext(ctx, `
			INSERT INTO life_routine_event_links (id, user_id, routine_id, gcal_event_id, link_type)
			VALUES ($1, $2, $3, $4, 'agent')
			ON CONFLICT (user_id, routine_id, gcal_event_id) DO NOTHING`,
			uuid.NewString(), userID, routineID, ev.ID)
	}

	result := map[string]any{
		"id":       ev.ID,
		"summary":  ev.Summary,
		"start":    ev.Start.Format(time.RFC3339),
		"end":      ev.End.Format(time.RFC3339),
		"htmlLink": ev.HtmlLink,
	}
	if routineID != "" {
		result["routine_id"] = routineID
	}
	return jsonOK(result)
}

func toolUpdateCalendarEvent(ctx context.Context, db *sql.DB, gcalClient *GCalClient, userID string, args map[string]any) string {
	if gcalClient == nil {
		return jsonError("Google Calendar is not configured")
	}
	eventID, _ := args["event_id"].(string)
	if eventID == "" {
		return jsonError("event_id is required")
	}

	accessToken, err := EnsureValidToken(ctx, db, gcalClient, userID)
	if err != nil {
		return jsonError("calendar not connected: " + err.Error())
	}

	req := CreateEventRequest{}
	req.Summary, _ = args["summary"].(string)
	req.Description, _ = args["description"].(string)
	req.Location, _ = args["location"].(string)

	if startStr, ok := args["start"].(string); ok && startStr != "" {
		if t, err := time.Parse(time.RFC3339, startStr); err == nil {
			req.StartTime = t
		}
	}
	if endStr, ok := args["end"].(string); ok && endStr != "" {
		if t, err := time.Parse(time.RFC3339, endStr); err == nil {
			req.EndTime = t
		}
	}

	ev, err := gcalClient.UpdateEvent(ctx, accessToken, eventID, req)
	if err != nil {
		return jsonError("failed to update calendar event: " + err.Error())
	}

	// Update local cache
	_, _ = db.ExecContext(ctx, `
		UPDATE life_gcal_events SET summary = COALESCE(NULLIF($3, ''), summary),
			start_time = CASE WHEN $4::timestamptz = '0001-01-01T00:00:00Z' THEN start_time ELSE $4 END,
			end_time = CASE WHEN $5::timestamptz = '0001-01-01T00:00:00Z' THEN end_time ELSE $5 END,
			updated_at = NOW()
		WHERE user_id = $1 AND id = $2`,
		userID, eventID, req.Summary, req.StartTime, req.EndTime,
	)

	return jsonOK(map[string]any{
		"event_id": ev.ID,
		"summary":  ev.Summary,
		"htmlLink": ev.HtmlLink,
		"updated":  true,
	})
}

func toolDeleteCalendarEvent(ctx context.Context, db *sql.DB, gcalClient *GCalClient, userID string, args map[string]any) string {
	if gcalClient == nil {
		return jsonError("Google Calendar is not configured")
	}
	eventID, _ := args["event_id"].(string)
	if eventID == "" {
		return jsonError("event_id is required")
	}

	accessToken, err := EnsureValidToken(ctx, db, gcalClient, userID)
	if err != nil {
		return jsonError("calendar not connected: " + err.Error())
	}

	if err := gcalClient.DeleteEvent(ctx, accessToken, eventID); err != nil {
		return jsonError("failed to delete calendar event: " + err.Error())
	}

	// Remove from local cache
	_, _ = db.ExecContext(ctx, `DELETE FROM life_gcal_events WHERE user_id = $1 AND id = $2`, userID, eventID)

	return jsonOK(map[string]any{"event_id": eventID, "deleted": true})
}

func toolLinkEventToRoutine(ctx context.Context, db *sql.DB, gcalClient *GCalClient, userID string, args map[string]any) string {
	eventID, _ := args["event_id"].(string)
	routineID, _ := args["routine_id"].(string)
	if eventID == "" || routineID == "" {
		return jsonError("event_id and routine_id are required")
	}

	// Verify routine exists and belongs to user
	var routineName string
	if err := db.QueryRowContext(ctx,
		`SELECT name FROM life_routines WHERE id = $1 AND user_id = $2`,
		routineID, userID).Scan(&routineName); err != nil {
		return jsonError("routine not found")
	}

	// Create the link record
	_, err := db.ExecContext(ctx, `
		INSERT INTO life_routine_event_links (id, user_id, routine_id, gcal_event_id, link_type)
		VALUES ($1, $2, $3, $4, 'agent')
		ON CONFLICT (user_id, routine_id, gcal_event_id) DO NOTHING`,
		uuid.NewString(), userID, routineID, eventID)
	if err != nil {
		return jsonError("failed to create link: " + err.Error())
	}

	// Update local cache
	_, _ = db.ExecContext(ctx, `UPDATE life_gcal_events SET routine_id = $1 WHERE user_id = $2 AND id = $3`,
		routineID, userID, eventID)

	// Patch Google Calendar extendedProperties
	if gcalClient != nil {
		if token, err := EnsureValidToken(ctx, db, gcalClient, userID); err == nil {
			_, _ = gcalClient.UpdateEvent(ctx, token, eventID, CreateEventRequest{RoutineID: routineID})
		}
	}

	return jsonOK(map[string]any{
		"linked":       true,
		"event_id":     eventID,
		"routine_id":   routineID,
		"routine_name": routineName,
	})
}

// ----- Google Tasks tool implementations -----

func resolveTaskListID(ctx context.Context, accessToken, listID string) (string, error) {
	if listID != "" {
		return listID, nil
	}
	lists, err := ListTaskLists(ctx, accessToken)
	if err != nil {
		return "", err
	}
	if len(lists) == 0 {
		return "", fmt.Errorf("no task lists found")
	}
	return lists[0].ID, nil
}

func toolListTasks(ctx context.Context, db *sql.DB, gcalClient *GCalClient, userID string, args map[string]any) string {
	if gcalClient == nil {
		return jsonError("Google is not configured")
	}
	accessToken, err := EnsureValidToken(ctx, db, gcalClient, userID)
	if err != nil {
		return jsonError("Google not connected: " + err.Error())
	}

	listID, _ := args["list_id"].(string)
	listID, err = resolveTaskListID(ctx, accessToken, listID)
	if err != nil {
		return jsonError("failed to resolve task list: " + err.Error())
	}

	showCompleted := false
	if v, ok := args["show_completed"].(bool); ok {
		showCompleted = v
	}

	tasks, err := ListTasks(ctx, accessToken, listID, showCompleted)
	if err != nil {
		return jsonError("failed to list tasks: " + err.Error())
	}
	return jsonOK(map[string]any{"tasks": tasks, "list_id": listID})
}

func toolCreateTask(ctx context.Context, db *sql.DB, gcalClient *GCalClient, userID string, args map[string]any) string {
	if gcalClient == nil {
		return jsonError("Google is not configured")
	}
	accessToken, err := EnsureValidToken(ctx, db, gcalClient, userID)
	if err != nil {
		return jsonError("Google not connected: " + err.Error())
	}

	title, _ := args["title"].(string)
	if title == "" {
		return jsonError("title is required")
	}
	notes, _ := args["notes"].(string)
	due, _ := args["due"].(string)

	listID, _ := args["list_id"].(string)
	listID, err = resolveTaskListID(ctx, accessToken, listID)
	if err != nil {
		return jsonError("failed to resolve task list: " + err.Error())
	}

	// Convert YYYY-MM-DD to RFC3339 date format expected by Google Tasks
	if due != "" && len(due) == 10 {
		due = due + "T00:00:00.000Z"
	}

	task, err := CreateTask(ctx, accessToken, listID, GTask{Title: title, Notes: notes, Due: due})
	if err != nil {
		return jsonError("failed to create task: " + err.Error())
	}
	return jsonOK(map[string]any{"task_id": task.ID, "title": task.Title, "created": true})
}

func toolCompleteTask(ctx context.Context, db *sql.DB, gcalClient *GCalClient, userID string, args map[string]any) string {
	if gcalClient == nil {
		return jsonError("Google is not configured")
	}
	accessToken, err := EnsureValidToken(ctx, db, gcalClient, userID)
	if err != nil {
		return jsonError("Google not connected: " + err.Error())
	}

	taskID, _ := args["task_id"].(string)
	if taskID == "" {
		return jsonError("task_id is required")
	}

	listID, _ := args["list_id"].(string)
	listID, err = resolveTaskListID(ctx, accessToken, listID)
	if err != nil {
		return jsonError("failed to resolve task list: " + err.Error())
	}

	task, err := CompleteTask(ctx, accessToken, listID, taskID)
	if err != nil {
		return jsonError("failed to complete task: " + err.Error())
	}
	return jsonOK(map[string]any{"task_id": task.ID, "completed": true})
}

func toolUpdateTask(ctx context.Context, db *sql.DB, gcalClient *GCalClient, userID string, args map[string]any) string {
	if gcalClient == nil {
		return jsonError("Google is not configured")
	}
	accessToken, err := EnsureValidToken(ctx, db, gcalClient, userID)
	if err != nil {
		return jsonError("Google not connected: " + err.Error())
	}

	taskID, _ := args["task_id"].(string)
	if taskID == "" {
		return jsonError("task_id is required")
	}

	listID, _ := args["list_id"].(string)
	listID, err = resolveTaskListID(ctx, accessToken, listID)
	if err != nil {
		return jsonError("failed to resolve task list: " + err.Error())
	}

	update := GTask{}
	if v, ok := args["title"].(string); ok {
		update.Title = v
	}
	if v, ok := args["notes"].(string); ok {
		update.Notes = v
	}
	if v, ok := args["due"].(string); ok {
		if len(v) == 10 {
			v = v + "T00:00:00.000Z"
		}
		update.Due = v
	}
	if v, ok := args["status"].(string); ok {
		update.Status = v
	}

	task, err := UpdateTask(ctx, accessToken, listID, taskID, update)
	if err != nil {
		return jsonError("failed to update task: " + err.Error())
	}
	return jsonOK(map[string]any{"task_id": task.ID, "updated": true})
}

func toolDeleteTask(ctx context.Context, db *sql.DB, gcalClient *GCalClient, userID string, args map[string]any) string {
	if gcalClient == nil {
		return jsonError("Google is not configured")
	}
	accessToken, err := EnsureValidToken(ctx, db, gcalClient, userID)
	if err != nil {
		return jsonError("Google not connected: " + err.Error())
	}

	taskID, _ := args["task_id"].(string)
	if taskID == "" {
		return jsonError("task_id is required")
	}

	listID, _ := args["list_id"].(string)
	listID, err = resolveTaskListID(ctx, accessToken, listID)
	if err != nil {
		return jsonError("failed to resolve task list: " + err.Error())
	}

	if err := DeleteTask(ctx, accessToken, listID, taskID); err != nil {
		return jsonError("failed to delete task: " + err.Error())
	}
	return jsonOK(map[string]any{"task_id": taskID, "deleted": true})
}

func toolCreateTaskList(ctx context.Context, db *sql.DB, gcalClient *GCalClient, userID string, args map[string]any) string {
	if gcalClient == nil {
		return jsonError("Google is not configured")
	}
	accessToken, err := EnsureValidToken(ctx, db, gcalClient, userID)
	if err != nil {
		return jsonError("Google not connected: " + err.Error())
	}
	title, _ := args["title"].(string)
	if title == "" {
		return jsonError("title is required")
	}
	list, err := CreateTaskList(ctx, accessToken, title)
	if err != nil {
		return jsonError("failed to create task list: " + err.Error())
	}
	return jsonOK(map[string]any{"list_id": list.ID, "title": list.Title, "created": true})
}

// ----- helpers -----

func jsonOK(v any) string {
	b, _ := json.Marshal(v)
	return string(b)
}

func jsonError(msg string) string {
	b, _ := json.Marshal(map[string]string{"error": msg})
	return string(b)
}

// nullableJSON returns nil if b is empty (so the DB column gets NULL), otherwise
// returns b so it is stored as JSONB.
func nullableJSON(b []byte) any {
	if len(b) == 0 {
		return nil
	}
	return fmt.Sprintf("%s", b)
}
