package database

import (
	"context"
	"database/sql"
	"embed"
	"fmt"
	"io/fs"
	"log"

	_ "github.com/lib/pq"
	"github.com/pressly/goose/v3"
)

//go:embed migrations/*.sql
var migrations embed.FS

// Open opens a *sql.DB connection using the provided DATABASE_URL and runs
// all pending goose migrations before returning. The caller owns the returned
// *sql.DB and is responsible for closing it.
func Open(databaseURL string) (*sql.DB, error) {
	if databaseURL == "" {
		return nil, fmt.Errorf("database: DATABASE_URL must not be empty")
	}

	db, err := sql.Open("postgres", databaseURL)
	if err != nil {
		return nil, fmt.Errorf("database: open connection: %w", err)
	}

	if err := db.Ping(); err != nil {
		db.Close()
		return nil, fmt.Errorf("database: ping: %w", err)
	}

	if err := runMigrations(db); err != nil {
		db.Close()
		return nil, err
	}

	return db, nil
}

func runMigrations(db *sql.DB) error {
	goose.SetLogger(goose.NopLogger())

	// embed.FS contains files under "migrations/" prefix — sub into it
	migrationsFS, err := fs.Sub(migrations, "migrations")
	if err != nil {
		return fmt.Errorf("database: sub migrations fs: %w", err)
	}

	provider, err := goose.NewProvider(
		goose.DialectPostgres,
		db,
		migrationsFS,
		goose.WithVerbose(false),
	)
	if err != nil {
		return fmt.Errorf("database: create migration provider: %w", err)
	}

	results, err := provider.Up(context.Background())
	if err != nil {
		return fmt.Errorf("database: run migrations: %w", err)
	}

	for _, r := range results {
		if r.Error != nil {
			return fmt.Errorf("database: migration %s: %w", r.Source.Path, r.Error)
		}
		if !r.Empty {
			log.Printf("database: applied migration %s", r.Source.Path)
		}
	}

	return nil
}
