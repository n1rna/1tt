package cmd

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"

	"github.com/n1rna/1tt/cli/internal/executor"
	"github.com/n1rna/1tt/cli/internal/ws"
	"github.com/spf13/cobra"
)

const (
	version     = "0.1.0"
	colorReset  = "\033[0m"
	colorGreen  = "\033[32m"
	colorYellow = "\033[33m"
	colorCyan   = "\033[36m"
	colorRed    = "\033[31m"
	colorBold   = "\033[1m"
	colorDim    = "\033[2m"
)

var (
	flagToken  string
	flagDB     string
	flagServer string
)

var tunnelCmd = &cobra.Command{
	Use:   "tunnel",
	Short: "Create a tunnel from your local database to the 1tt.dev web studio",
	Long: `Opens a secure WebSocket tunnel between your local database and the 1tt.dev
web studio. Supports PostgreSQL and Redis connection strings.

Examples:
  1tt tunnel --token mytoken --db postgres://user:pass@localhost:5432/mydb
  1tt tunnel --token mytoken --db redis://localhost:6379`,
	RunE: runTunnel,
}

func init() {
	tunnelCmd.Flags().StringVar(&flagToken, "token", "", "Authentication token from 1tt.dev (required)")
	tunnelCmd.Flags().StringVar(&flagDB, "db", "", "Database connection string (required)")
	tunnelCmd.Flags().StringVar(&flagServer, "server", "wss://api.1tt.dev/api/v1/tunnel", "WebSocket server URL")

	_ = tunnelCmd.MarkFlagRequired("token")
	_ = tunnelCmd.MarkFlagRequired("db")
}

func isTTY() bool {
	fi, err := os.Stdout.Stat()
	if err != nil {
		return false
	}
	return (fi.Mode() & os.ModeCharDevice) != 0
}

func color(c, s string) string {
	if !isTTY() {
		return s
	}
	return c + s + colorReset
}

func printBanner() {
	fmt.Println()
	fmt.Println(color(colorBold+colorCyan, "  1tt.dev tunnel v"+version))
	fmt.Println(color(colorDim, "  ─────────────────────────────"))
	fmt.Println()
}

func detectDialect(connStr string) (string, error) {
	lower := strings.ToLower(connStr)
	switch {
	case strings.HasPrefix(lower, "postgres://"), strings.HasPrefix(lower, "postgresql://"):
		return "postgres", nil
	case strings.HasPrefix(lower, "redis://"), strings.HasPrefix(lower, "rediss://"):
		return "redis", nil
	default:
		return "", fmt.Errorf("unsupported connection string scheme — expected postgres://, postgresql://, redis://, or rediss://")
	}
}

// dbExecutor is the common interface satisfied by both PostgresExecutor and RedisExecutor.
type dbExecutor interface {
	GetVersion(ctx context.Context) (string, error)
	GetSchema(ctx context.Context) ([]executor.SchemaTable, error)
	Close()
}

// queryExecutor is satisfied only by PostgresExecutor.
type queryExecutor interface {
	Execute(ctx context.Context, sql string) (*executor.Result, error)
}

// redisExecutorIface is the Redis-specific execute signature.
type redisExecutorIface interface {
	Execute(ctx context.Context, args []string) (any, error)
}

func runTunnel(cmd *cobra.Command, args []string) error {
	printBanner()

	dialect, err := detectDialect(flagDB)
	if err != nil {
		return err
	}

	// --- Connect to local database ---
	fmt.Printf("  %s Connecting to local %s database...\n", color(colorYellow, "→"), dialect)

	ctx := context.Background()

	var pgExec *executor.PostgresExecutor
	var rdExec *executor.RedisExecutor
	var dbExec dbExecutor

	switch dialect {
	case "postgres":
		pgExec, err = executor.NewPostgres(flagDB)
		if err != nil {
			return fmt.Errorf("%s failed to connect to PostgreSQL: %w", color(colorRed, "✗"), err)
		}
		dbExec = pgExec
		defer pgExec.Close()
	case "redis":
		rdExec, err = executor.NewRedis(flagDB)
		if err != nil {
			return fmt.Errorf("%s failed to connect to Redis: %w", color(colorRed, "✗"), err)
		}
		dbExec = rdExec
		defer rdExec.Close()
	}

	fmt.Printf("  %s Connected to local %s database\n", color(colorGreen, "✓"), dialect)

	// --- Get database version ---
	dbVersion, err := dbExec.GetVersion(ctx)
	if err != nil {
		dbVersion = "unknown"
	}
	fmt.Printf("  %s %s\n", color(colorDim, "version:"), color(colorDim, dbVersion))
	fmt.Println()

	// --- Open WebSocket ---
	serverURL := strings.TrimRight(flagServer, "/") + "/" + flagToken + "/ws"
	fmt.Printf("  %s Connecting to 1tt.dev tunnel server...\n", color(colorYellow, "→"))

	var wsClient *ws.Client
	wsClient, err = connectWithBackoff(serverURL, 5)
	if err != nil {
		return fmt.Errorf("%s failed to reach tunnel server: %w", color(colorRed, "✗"), err)
	}
	defer wsClient.Close()

	fmt.Printf("  %s Tunnel server connected\n", color(colorGreen, "✓"))

	// --- Send ready message ---
	readyPayload, _ := json.Marshal(map[string]string{
		"dialect": dialect,
		"version": dbVersion,
	})
	if err := wsClient.Send(ws.Message{
		Type:    "ready",
		Dialect: dialect,
		Payload: json.RawMessage(readyPayload),
	}); err != nil {
		return fmt.Errorf("failed to send ready message: %w", err)
	}

	fmt.Println()
	fmt.Printf("  %s\n", color(colorBold+colorGreen, "Tunnel active — open 1tt.dev to use the studio"))
	fmt.Printf("  %s\n", color(colorDim, "Press Ctrl+C to close the tunnel"))
	fmt.Println()

	// --- Signal handling ---
	sigCh := make(chan os.Signal, 1)
	signal.Notify(sigCh, os.Interrupt, syscall.SIGTERM)

	msgCh := make(chan ws.Message, 8)
	errCh := make(chan error, 1)

	go func() {
		for {
			msg, err := wsClient.ReadMessage()
			if err != nil {
				errCh <- err
				return
			}
			msgCh <- msg
		}
	}()

	for {
		select {
		case <-sigCh:
			fmt.Println()
			fmt.Printf("  %s Tunnel closed\n", color(colorYellow, "→"))
			return nil

		case err := <-errCh:
			if strings.Contains(err.Error(), "close") || strings.Contains(err.Error(), "EOF") {
				fmt.Printf("  %s Tunnel closed by server\n", color(colorYellow, "→"))
				return nil
			}
			return fmt.Errorf("websocket error: %w", err)

		case msg := <-msgCh:
			if err := handleMessage(ctx, msg, wsClient, dialect, pgExec, rdExec, dbExec); err != nil {
				fmt.Printf("  %s handler error: %v\n", color(colorRed, "✗"), err)
			}
		}
	}
}

func handleMessage(
	ctx context.Context,
	msg ws.Message,
	wsClient *ws.Client,
	dialect string,
	pgExec *executor.PostgresExecutor,
	rdExec *executor.RedisExecutor,
	dbExec dbExecutor,
) error {
	switch msg.Type {
	case "ping":
		return wsClient.Send(ws.Message{Type: "pong"})

	case "query":
		return handleQuery(ctx, msg, wsClient, dialect, pgExec, rdExec)

	case "schema":
		return handleSchema(ctx, msg, wsClient, dbExec)

	default:
		// unknown message type — ignore silently
		return nil
	}
}

func handleQuery(
	ctx context.Context,
	msg ws.Message,
	wsClient *ws.Client,
	dialect string,
	pgExec *executor.PostgresExecutor,
	rdExec *executor.RedisExecutor,
) error {
	switch dialect {
	case "postgres":
		var payload struct {
			SQL string `json:"sql"`
		}
		if err := json.Unmarshal(msg.Payload, &payload); err != nil {
			return sendError(wsClient, msg.ID, "invalid query payload: "+err.Error())
		}
		result, err := pgExec.Execute(ctx, payload.SQL)
		if err != nil {
			return sendError(wsClient, msg.ID, err.Error())
		}
		return sendResult(wsClient, msg.ID, result)

	case "redis":
		var payload struct {
			Args []string `json:"args"`
		}
		if err := json.Unmarshal(msg.Payload, &payload); err != nil {
			return sendError(wsClient, msg.ID, "invalid query payload: "+err.Error())
		}
		result, err := rdExec.Execute(ctx, payload.Args)
		if err != nil {
			return sendError(wsClient, msg.ID, err.Error())
		}
		return sendResult(wsClient, msg.ID, result)
	}
	return nil
}

func handleSchema(ctx context.Context, msg ws.Message, wsClient *ws.Client, dbExec dbExecutor) error {
	tables, err := dbExec.GetSchema(ctx)
	if err != nil {
		return sendError(wsClient, msg.ID, err.Error())
	}
	return sendResult(wsClient, msg.ID, tables)
}

func sendResult(wsClient *ws.Client, id string, data any) error {
	payload, err := json.Marshal(data)
	if err != nil {
		return err
	}
	return wsClient.Send(ws.Message{
		ID:      id,
		Type:    "result",
		Payload: json.RawMessage(payload),
	})
}

func sendError(wsClient *ws.Client, id, errMsg string) error {
	payload, _ := json.Marshal(map[string]string{"error": errMsg})
	return wsClient.Send(ws.Message{
		ID:      id,
		Type:    "error",
		Payload: json.RawMessage(payload),
	})
}

func connectWithBackoff(url string, maxAttempts int) (*ws.Client, error) {
	var lastErr error
	for i := 0; i < maxAttempts; i++ {
		if i > 0 {
			wait := time.Duration(i*i) * time.Second
			fmt.Printf("  %s retrying in %s...\n", color(colorYellow, "→"), wait)
			time.Sleep(wait)
		}
		client, err := ws.Connect(url)
		if err == nil {
			return client, nil
		}
		lastErr = err
	}
	return nil, lastErr
}
