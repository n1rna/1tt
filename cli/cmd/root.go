package cmd

import (
	"os"

	"github.com/spf13/cobra"
)

var rootCmd = &cobra.Command{
	Use:     "1tt",
	Version: "0.1.0",
	Short:   "1tt.dev CLI — connect your databases to the web studio",
	Long: `1tt.dev CLI — connect your databases to the web studio.

Use 'tunnel' to expose a local database through a secure WebSocket tunnel
so you can query it from the 1tt.dev web studio without exposing it to the internet.`,
}

// Execute is the entry point called from main.
func Execute() {
	if err := rootCmd.Execute(); err != nil {
		os.Exit(1)
	}
}

func init() {
	rootCmd.AddCommand(tunnelCmd)
}
