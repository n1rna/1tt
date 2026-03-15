package agent

import (
	"context"
	"fmt"
	"os"
	"strings"
	"testing"

	"github.com/n1rna/1two/api/internal/crawl"
)

// TestGenerateLlmsTxtIntegration is an integration test that verifies the full
// LLM agent flow: list pages → read pages → generate llms.txt.
//
// It requires a valid LLM API key. Set these env vars to run:
//   LLM_API_KEY=your-key
//   LLM_BASE_URL=https://api.moonshot.ai/v1 (optional, defaults to this)
//   LLM_MODEL=kimi-k2-0711 (optional, defaults to this)
//
// Run with: go test -v -run TestGenerateLlmsTxtIntegration -timeout 120s ./internal/agent/
func TestGenerateLlmsTxtIntegration(t *testing.T) {
	apiKey := os.Getenv("LLM_API_KEY")
	if apiKey == "" {
		t.Skip("LLM_API_KEY not set — skipping integration test")
	}

	baseURL := os.Getenv("LLM_BASE_URL")
	if baseURL == "" {
		baseURL = "https://api.moonshot.ai/v1"
	}
	model := os.Getenv("LLM_MODEL")
	if model == "" {
		model = "kimi-k2-0711"
	}

	cfg := LLMConfig{
		Provider: "openai",
		APIKey:   apiKey,
		BaseURL:  baseURL,
		Model:    model,
	}

	// Create realistic test pages simulating a small documentation site
	pages := []crawl.CrawlPage{
		{
			URL:        "https://example-lib.dev/",
			Title:      "ExampleLib - A Modern Widget Library",
			StatusCode: 200,
			Markdown: `# ExampleLib

ExampleLib is a modern widget library for building interactive dashboards.

## Features
- Real-time data binding
- Drag-and-drop layout editor
- 50+ pre-built widget components
- TypeScript support
- Theme customization

## Quick Start
Install with npm:
` + "```bash\nnpm install examplelib\n```" + `

## Links
- [Documentation](/docs)
- [API Reference](/api)
- [Examples](/examples)
- [GitHub](https://github.com/example/examplelib)
`,
		},
		{
			URL:        "https://example-lib.dev/docs",
			Title:      "Documentation - ExampleLib",
			StatusCode: 200,
			Markdown: `# ExampleLib Documentation

## Getting Started

### Installation
` + "```bash\nnpm install examplelib\n```" + `

### Basic Usage
` + "```typescript\nimport { Dashboard, Widget } from 'examplelib';\n\nconst app = new Dashboard({\n  container: '#app',\n  theme: 'dark',\n});\n\napp.addWidget(new Widget.Chart({\n  type: 'line',\n  data: myData,\n}));\n```" + `

### Configuration
ExampleLib accepts the following configuration options:
- **container**: CSS selector for the mount point
- **theme**: 'light' | 'dark' | custom theme object
- **locale**: Language locale (default: 'en')
- **plugins**: Array of plugin instances

## Architecture
ExampleLib uses a reactive state management system internally. Each widget subscribes to data sources and re-renders automatically when data changes.

The core modules are:
- **Core**: State management and event system
- **Widgets**: Built-in widget components
- **Layout**: Grid-based layout engine
- **Themes**: Theming and styling system
`,
		},
		{
			URL:        "https://example-lib.dev/api",
			Title:      "API Reference - ExampleLib",
			StatusCode: 200,
			Markdown: `# API Reference

## Dashboard Class

### Constructor
` + "```typescript\nnew Dashboard(options: DashboardOptions)\n```" + `

### Methods
- **addWidget(widget: Widget)**: Add a widget to the dashboard
- **removeWidget(id: string)**: Remove a widget by ID
- **setTheme(theme: Theme)**: Change the active theme
- **getData()**: Get the current dashboard state
- **destroy()**: Clean up and unmount

## Widget Class

### Built-in Widgets
- **Widget.Chart**: Line, bar, pie, scatter charts
- **Widget.Table**: Data tables with sorting and filtering
- **Widget.Metric**: Single-value KPI display
- **Widget.Map**: Geographic map visualization
- **Widget.Text**: Rich text content block

### Custom Widgets
` + "```typescript\nclass MyWidget extends Widget.Base {\n  render(data: any) {\n    return `<div>${data.value}</div>`;\n  }\n}\n```" + `
`,
		},
		{
			URL:        "https://example-lib.dev/examples",
			Title:      "Examples - ExampleLib",
			StatusCode: 200,
			Markdown: `# Examples

## Basic Dashboard
A simple dashboard with a chart and a metric widget.

## Real-time Dashboard
Connect to a WebSocket data source for live updates.

## Multi-page Dashboard
Create a dashboard with multiple pages and navigation.

## Embedded Dashboard
Embed a dashboard inside an existing React or Vue application.
`,
		},
		{
			URL:        "https://example-lib.dev/changelog",
			Title:      "Changelog - ExampleLib",
			StatusCode: 200,
			Markdown: `# Changelog

## v2.1.0 (2026-03-01)
- Added scatter chart widget
- Fixed theme switching bug
- Improved TypeScript types

## v2.0.0 (2026-01-15)
- Complete rewrite with new architecture
- Added plugin system
- New layout engine
`,
		},
	}

	t.Logf("Running GenerateLlmsTxt with %d pages...", len(pages))

	// Also wrap the tools to log calls
	ctx := context.Background()
	result, usage, err := GenerateLlmsTxt(ctx, cfg, pages, "standard", "website")
	if err != nil {
		t.Fatalf("GenerateLlmsTxt failed: %v", err)
	}

	t.Logf("Token usage: input=%d, output=%d, total=%d", usage.InputTokens, usage.OutputTokens, usage.InputTokens+usage.OutputTokens)
	t.Logf("Result length: %d bytes", len(result))
	t.Logf("--- Result ---\n%s\n--- End ---", result)

	// Verify the output references actual page content
	if result == "" {
		t.Fatal("Result is empty")
	}

	// Check that the output contains references to our test pages
	checks := []struct {
		name    string
		check   func() bool
	}{
		{"mentions ExampleLib", func() bool { return strings.Contains(result, "ExampleLib") }},
		{"contains URLs", func() bool { return strings.Contains(result, "example-lib.dev") }},
		{"mentions Dashboard", func() bool { return strings.Contains(strings.ToLower(result), "dashboard") }},
		{"mentions API", func() bool { return strings.Contains(strings.ToLower(result), "api") }},
		{"mentions Widget", func() bool { return strings.Contains(strings.ToLower(result), "widget") }},
		{"has section headers", func() bool { return strings.Contains(result, "##") }},
		{"has markdown links", func() bool { return strings.Contains(result, "](") }},
	}

	for _, c := range checks {
		if !c.check() {
			t.Errorf("FAIL: %s — the generated llms.txt does not pass this check", c.name)
		} else {
			t.Logf("PASS: %s", c.name)
		}
	}
}

// TestPageStoreToolsDirectly tests the tools in isolation to verify they return
// correct data from the page store.
func TestPageStoreToolsDirectly(t *testing.T) {
	pages := []crawl.CrawlPage{
		{URL: "https://example.com/", Title: "Home", StatusCode: 200, Markdown: "# Welcome\nThis is the home page."},
		{URL: "https://example.com/about", Title: "About", StatusCode: 200, Markdown: "# About\nWe build cool stuff."},
		{URL: "https://example.com/docs", Title: "Docs", StatusCode: 200, Markdown: "# Documentation\n## Getting Started\nInstall with npm."},
	}

	store := newPageStore(pages)
	ctx := context.Background()

	// Test list_pages
	t.Run("list_pages", func(t *testing.T) {
		tool := &listPagesTool{store: store}
		result, err := tool.Execute(ctx, "{}")
		if err != nil {
			t.Fatalf("list_pages failed: %v", err)
		}
		t.Logf("list_pages output:\n%s", result)

		if !strings.Contains(result, "Total pages: 3") {
			t.Error("Expected 'Total pages: 3'")
		}
		for _, p := range pages {
			if !strings.Contains(result, p.URL) {
				t.Errorf("Missing URL: %s", p.URL)
			}
			if !strings.Contains(result, p.Title) {
				t.Errorf("Missing title: %s", p.Title)
			}
			sizeStr := fmt.Sprintf("%d bytes", len(p.Markdown))
			if !strings.Contains(result, sizeStr) {
				t.Errorf("Missing size for %s: expected %s", p.URL, sizeStr)
			}
		}
	})

	// Test read_page
	t.Run("read_page", func(t *testing.T) {
		tool := &readPageTool{store: store}

		result, err := tool.Execute(ctx, `{"url":"https://example.com/docs"}`)
		if err != nil {
			t.Fatalf("read_page failed: %v", err)
		}
		t.Logf("read_page output:\n%s", result)

		if !strings.Contains(result, "# Documentation") {
			t.Error("Expected markdown content from docs page")
		}
		if !strings.Contains(result, "Getting Started") {
			t.Error("Expected 'Getting Started' section")
		}

		// Test page not found
		result2, err := tool.Execute(ctx, `{"url":"https://example.com/nonexistent"}`)
		if err != nil {
			t.Fatalf("read_page (not found) failed: %v", err)
		}
		if !strings.Contains(result2, "Page not found") {
			t.Error("Expected 'Page not found' message")
		}
	})

	// Test write_llms_txt
	t.Run("write_llms_txt", func(t *testing.T) {
		tool := &writeLlmsTxtTool{store: store}
		content := "# Example\n> A test site\n\n## Docs\n- [Docs](https://example.com/docs): Documentation"

		result, err := tool.Execute(ctx, fmt.Sprintf(`{"content":%q}`, content))
		if err != nil {
			t.Fatalf("write_llms_txt failed: %v", err)
		}
		if !strings.Contains(result, "successfully") {
			t.Error("Expected success message")
		}
		if store.result != content {
			t.Errorf("Store result mismatch.\nExpected: %s\nGot: %s", content, store.result)
		}
	})
}
