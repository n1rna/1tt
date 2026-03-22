package handler

import (
	"encoding/base64"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"
)

// namedColors maps shields.io-compatible color names to hex values.
var namedColors = map[string]string{
	"brightgreen":   "#4c1",
	"green":         "#97ca00",
	"yellow":        "#dfb317",
	"yellowgreen":   "#a4a61d",
	"orange":        "#fe7d37",
	"red":           "#e05d44",
	"blue":          "#007ec6",
	"grey":          "#555",
	"lightgrey":     "#9f9f9f",
	"gray":          "#555",
	"lightgray":     "#9f9f9f",
	"success":       "#4c1",
	"important":     "#fe7d37",
	"critical":      "#e05d44",
	"informational": "#007ec6",
	"inactive":      "#9f9f9f",
}

// resolveColor converts a named color or bare hex string to a full hex value.
// Input may be a name ("blue"), a 3-char hex ("4c1"), or a 6-char hex ("007ec6").
// The leading '#' is always included in the returned value.
func resolveColor(raw string) string {
	raw = strings.ToLower(strings.TrimSpace(raw))
	if raw == "" {
		return "#4c1" // default brightgreen
	}
	if named, ok := namedColors[raw]; ok {
		return named
	}
	// bare hex — strip # if the caller included it, then validate length
	stripped := strings.TrimPrefix(raw, "#")
	if len(stripped) == 3 || len(stripped) == 6 {
		return "#" + stripped
	}
	return "#555" // fallback grey
}

// badgeSegmentDecode applies shields.io path-segment escaping rules:
//
//	"__"  → literal underscore
//	"--"  → literal dash
//	"_"   → space
//
// URL percent-encoding is already decoded by the HTTP layer before we receive it.
func badgeSegmentDecode(s string) string {
	// Order matters: decode doubled sequences before singles.
	s = strings.ReplaceAll(s, "__", "\x00UNDER\x00")
	s = strings.ReplaceAll(s, "--", "\x00DASH\x00")
	s = strings.ReplaceAll(s, "_", " ")
	s = strings.ReplaceAll(s, "\x00UNDER\x00", "_")
	s = strings.ReplaceAll(s, "\x00DASH\x00", "-")
	return s
}

// charWidth returns an approximate pixel width for a string rendered in
// Verdana 11px.  The multiplier is tuned to match shields.io sizing.
func charWidth(s string, perChar float64) float64 {
	if strings.TrimSpace(s) == "" {
		return 0
	}
	return float64(len(s))*perChar + 20 // 10px padding each side
}

// escapeSVG replaces XML special characters so the strings are safe to embed
// directly in SVG text nodes.
func escapeSVG(s string) string {
	s = strings.ReplaceAll(s, "&", "&amp;")
	s = strings.ReplaceAll(s, "<", "&lt;")
	s = strings.ReplaceAll(s, ">", "&gt;")
	s = strings.ReplaceAll(s, "\"", "&quot;")
	return s
}

// ── SVG style generators ───────────────────────────────────────────────────────

type badgeParams struct {
	label      string
	message    string
	labelColor string
	msgColor   string
	style      string
	logoSVG    string // base64 data URI of the logo SVG
}

// logoOffset returns the extra width needed for the logo area and the
// SVG <image> element string. height is the badge height (20 or 28).
func logoLayout(p badgeParams, height int) (extraW float64, element string) {
	if p.logoSVG == "" {
		return 0, ""
	}
	iconH := float64(height) - 6.0 // 3px top/bottom padding
	iconW := iconH                   // square icon
	extraW = iconW + 7.0             // icon + right padding
	x := 5.0
	y := 3.0
	element = fmt.Sprintf(`<image x="%.0f" y="%.0f" width="%.0f" height="%.0f" href="%s"/>`,
		x, y, iconW, iconH, p.logoSVG)
	return extraW, element
}

func renderFlat(p badgeParams) string {
	cw := 6.5
	logoW, logoElement := logoLayout(p, 20)
	lw := charWidth(p.label, cw) + logoW
	mw := charWidth(p.message, cw)
	if p.label == "" && logoW == 0 {
		lw = 0
	} else if p.label == "" && logoW > 0 {
		lw = logoW + 2
	}
	tw := lw + mw
	lx := logoW + (lw-logoW)/2 + 1
	mx := lw + mw/2 + 1

	lLabel := escapeSVG(p.label)
	lMsg := escapeSVG(p.message)

	var labelRect string
	if lw > 0 {
		labelRect = fmt.Sprintf(`<rect width="%.0f" height="20" fill="%s"/>`, lw, p.labelColor)
	}

	var labelText string
	if p.label != "" {
		labelText = fmt.Sprintf(`
    <text x="%.1f" y="14" fill="#010101" fill-opacity=".3">%s</text>
    <text x="%.1f" y="13">%s</text>`, lx, lLabel, lx, lLabel)
	}

	return fmt.Sprintf(`<svg xmlns="http://www.w3.org/2000/svg" width="%.0f" height="20">
  <linearGradient id="b" x2="0" y2="100%%">
    <stop offset="0" stop-color="#bbb" stop-opacity=".1"/>
    <stop offset="1" stop-opacity=".1"/>
  </linearGradient>
  <clipPath id="a">
    <rect width="%.0f" height="20" rx="3" fill="#fff"/>
  </clipPath>
  <g clip-path="url(#a)">
    %s
    <rect x="%.0f" width="%.0f" height="20" fill="%s"/>
    <rect width="%.0f" height="20" fill="url(#b)"/>
  </g>
  %s
  <g fill="#fff" text-anchor="middle" font-family="Verdana,Geneva,DejaVu Sans,sans-serif" font-size="11" text-rendering="geometricPrecision">
    %s
    <text x="%.1f" y="14" fill="#010101" fill-opacity=".3">%s</text>
    <text x="%.1f" y="13">%s</text>
  </g>
</svg>`,
		tw, tw,
		labelRect,
		lw, mw, p.msgColor,
		tw,
		logoElement,
		labelText,
		mx, lMsg,
		mx, lMsg,
	)
}

func renderFlatSquare(p badgeParams) string {
	cw := 6.5
	logoW, logoElement := logoLayout(p, 20)
	lw := charWidth(p.label, cw) + logoW
	mw := charWidth(p.message, cw)
	if p.label == "" && logoW == 0 { lw = 0 } else if p.label == "" && logoW > 0 { lw = logoW + 2 }
	tw := lw + mw
	lx := logoW + (lw-logoW)/2 + 1
	mx := lw + mw/2 + 1

	lLabel := escapeSVG(p.label)
	lMsg := escapeSVG(p.message)

	var labelRect string
	if lw > 0 {
		labelRect = fmt.Sprintf(`<rect width="%.0f" height="20" fill="%s"/>`, lw, p.labelColor)
	}

	var labelText string
	if p.label != "" {
		labelText = fmt.Sprintf(`
    <text x="%.1f" y="14" fill="#010101" fill-opacity=".3">%s</text>
    <text x="%.1f" y="13">%s</text>`, lx, lLabel, lx, lLabel)
	}

	return fmt.Sprintf(`<svg xmlns="http://www.w3.org/2000/svg" width="%.0f" height="20">
  <g>
    %s
    <rect x="%.0f" width="%.0f" height="20" fill="%s"/>
  </g>
  %s
  <g fill="#fff" text-anchor="middle" font-family="Verdana,Geneva,DejaVu Sans,sans-serif" font-size="11" text-rendering="geometricPrecision">
    %s
    <text x="%.1f" y="14" fill="#010101" fill-opacity=".3">%s</text>
    <text x="%.1f" y="13">%s</text>
  </g>
</svg>`,
		tw,
		labelRect,
		lw, mw, p.msgColor,
		logoElement,
		labelText,
		mx, lMsg,
		mx, lMsg,
	)
}

func renderPlastic(p badgeParams) string {
	cw := 6.5
	logoW, logoElement := logoLayout(p, 18)
	lw := charWidth(p.label, cw) + logoW
	mw := charWidth(p.message, cw)
	if p.label == "" && logoW == 0 { lw = 0 } else if p.label == "" && logoW > 0 { lw = logoW + 2 }
	tw := lw + mw
	lx := logoW + (lw-logoW)/2 + 1
	mx := lw + mw/2 + 1

	lLabel := escapeSVG(p.label)
	lMsg := escapeSVG(p.message)

	var labelRect string
	if p.label != "" {
		labelRect = fmt.Sprintf(`<rect width="%.0f" height="18" fill="%s"/>`, lw, p.labelColor)
	}

	var labelText string
	if p.label != "" {
		labelText = fmt.Sprintf(`
    <text x="%.1f" y="14" fill="#010101" fill-opacity=".3">%s</text>
    <text x="%.1f" y="13">%s</text>`, lx, lLabel, lx, lLabel)
	}

	return fmt.Sprintf(`<svg xmlns="http://www.w3.org/2000/svg" width="%.0f" height="18">
  <linearGradient id="s" x2="0" y2="100%%">
    <stop offset="0" stop-color="#fff" stop-opacity=".7"/>
    <stop offset=".1" stop-color="#aaa" stop-opacity=".1"/>
    <stop offset=".9" stop-opacity=".3"/>
    <stop offset="1" stop-opacity=".5"/>
  </linearGradient>
  <clipPath id="a">
    <rect width="%.0f" height="18" rx="4" fill="#fff"/>
  </clipPath>
  <g clip-path="url(#a)">
    %s
    <rect x="%.0f" width="%.0f" height="18" fill="%s"/>
    <rect width="%.0f" height="18" fill="url(#s)"/>
  </g>
  %s
  <g fill="#fff" text-anchor="middle" font-family="Verdana,Geneva,DejaVu Sans,sans-serif" font-size="11" text-rendering="geometricPrecision">
    %s
    <text x="%.1f" y="13" fill="#010101" fill-opacity=".3">%s</text>
    <text x="%.1f" y="12">%s</text>
  </g>
</svg>`,
		tw, tw,
		labelRect,
		lw, mw, p.msgColor,
		tw,
		logoElement,
		labelText,
		mx, lMsg,
		mx, lMsg,
	)
}

func renderForTheBadge(p badgeParams) string {
	cw := 7.5
	logoW, logoElement := logoLayout(p, 28)
	label := strings.ToUpper(p.label)
	message := strings.ToUpper(p.message)
	lw := charWidth(label, cw) + logoW
	mw := charWidth(message, cw)
	if label == "" && logoW == 0 { lw = 0 } else if label == "" && logoW > 0 { lw = logoW + 2 }
	tw := lw + mw
	lx := logoW + (lw-logoW)/2 + 1
	mx := lw + mw/2 + 1

	lLabel := escapeSVG(label)
	lMsg := escapeSVG(message)

	var labelRect string
	var labelText string
	if label != "" {
		labelRect = fmt.Sprintf(`<rect width="%.0f" height="28" fill="%s"/>`, lw, p.labelColor)
		labelText = fmt.Sprintf(`
    <text x="%.1f" y="19" fill="#fff" font-weight="bold" letter-spacing="1">%s</text>`, lx, lLabel)
	}

	return fmt.Sprintf(`<svg xmlns="http://www.w3.org/2000/svg" width="%.0f" height="28">
  <g>
    %s
    <rect x="%.0f" width="%.0f" height="28" fill="%s"/>
  </g>
  %s
  <g fill="#fff" text-anchor="middle" font-family="Verdana,Geneva,DejaVu Sans,sans-serif" font-size="11" text-rendering="geometricPrecision">
    %s
    <text x="%.1f" y="19" fill="#fff" font-weight="bold" letter-spacing="1">%s</text>
  </g>
</svg>`,
		tw,
		labelRect,
		lw, mw, p.msgColor,
		logoElement,
		labelText,
		mx, lMsg,
	)
}

func renderSocial(p badgeParams) string {
	cw := 6.5
	logoW, logoElement := logoLayout(p, 20)
	lw := charWidth(p.label, cw) + logoW
	mw := charWidth(p.message, cw)
	if p.label == "" && logoW == 0 { lw = 0 } else if p.label == "" && logoW > 0 { lw = logoW + 2 }
	tw := lw + mw
	lx := logoW + (lw-logoW)/2 + 1
	mx := lw + mw/2 + 1

	lLabel := escapeSVG(p.label)
	lMsg := escapeSVG(p.message)

	var labelPart string
	if p.label != "" {
		labelPart = fmt.Sprintf(`
  <rect width="%.0f" height="20" rx="3" fill="%s"/>
  <rect x="%.0f" width="%.0f" height="20" rx="3" fill="%s"/>
  <rect x="%.0f" width="%.0f" height="20" fill="%s"/>
  <path d="M%.0f 0 h 4 v 20 h-4 z" fill="%s"/>`, lw, p.labelColor, lw, mw, p.msgColor, lw+2, mw-2, p.msgColor, lw-2, p.msgColor)
	} else {
		labelPart = fmt.Sprintf(`<rect width="%.0f" height="20" rx="3" fill="%s"/>`, mw, p.msgColor)
	}

	var labelText string
	if p.label != "" {
		labelText = fmt.Sprintf(`<text x="%.1f" y="14" fill="#555" fill-opacity=".6">%s</text>
    <text x="%.1f" y="13" fill="%s">%s</text>`, lx, lLabel, lx, p.labelColor, lLabel)
	}

	return fmt.Sprintf(`<svg xmlns="http://www.w3.org/2000/svg" width="%.0f" height="20">
  <style>a:hover #llink{fill:url(#b);stroke:#ccc}</style>
  %s
  %s
  <g fill="#fff" text-anchor="middle" font-family="Helvetica Neue,Helvetica,Arial,sans-serif" font-size="11" text-rendering="geometricPrecision">
    %s
    <text x="%.1f" y="14" fill="#fff" fill-opacity=".4">%s</text>
    <text x="%.1f" y="13" fill="#fff">%s</text>
  </g>
</svg>`,
		tw,
		labelPart,
		logoElement,
		labelText,
		mx, lMsg,
		mx, lMsg,
	)
}

// ── Main handler ───────────────────────────────────────────────────────────────

// Badge serves shields.io-compatible SVG badges.
//
// Route: GET /badge/*
//
// Path format (after /badge/):
//
//	{label}-{message}-{color}.svg   — three-part
//	{message}-{color}.svg           — two-part (no label)
//
// fetchSimpleIcon fetches an SVG icon from the simple-icons CDN and returns
// it as a data URI suitable for embedding in an SVG <image> element.
// Returns "" if the icon can't be fetched.
func fetchSimpleIcon(slug, color string) string {
	if color == "" {
		color = "white"
	}
	url := fmt.Sprintf("https://cdn.simpleicons.org/%s/%s", slug, color)

	client := &http.Client{Timeout: 3 * time.Second}
	resp, err := client.Get(url)
	if err != nil || resp.StatusCode != 200 {
		return ""
	}
	defer resp.Body.Close()

	data, err := io.ReadAll(io.LimitReader(resp.Body, 32*1024)) // max 32KB
	if err != nil || len(data) == 0 {
		return ""
	}

	// Encode as base64 data URI for embedding in SVG
	encoded := base64.StdEncoding.EncodeToString(data)
	return "data:image/svg+xml;base64," + encoded
}

// Query params: style, labelColor, logo, logoColor, logoSize
func Badge() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		// chi wildcard includes the leading slash; trim it.
		raw := strings.TrimPrefix(r.URL.Path, "/api/v1/badge/")
		raw = strings.TrimPrefix(raw, "/badge/")

		// Strip .svg extension
		raw = strings.TrimSuffix(raw, ".svg")

		// URL-decode the path segment (handles %20 etc.)
		decoded, err := url.PathUnescape(raw)
		if err != nil {
			decoded = raw
		}

		// Split on "-" to get label, message, color.
		// The spec is: last part = color, second-to-last = message, rest joined = label.
		parts := strings.Split(decoded, "-")
		var label, message, colorRaw string
		switch len(parts) {
		case 0, 1:
			// Degenerate — treat the whole thing as message with default color.
			message = decoded
			colorRaw = "blue"
		case 2:
			message = parts[0]
			colorRaw = parts[1]
		default:
			// Three or more: last is color, second-to-last is message, rest is label.
			colorRaw = parts[len(parts)-1]
			message = parts[len(parts)-2]
			label = strings.Join(parts[:len(parts)-2], "-")
		}

		// Handle _empty marker — icon-only badge with no text.
		// Must check before badgeSegmentDecode since _ is a space in shields encoding.
		if message == "_empty" {
			message = ""
		}
		if label == "_empty" {
			label = ""
		}

		// Apply shields.io path encoding rules.
		label = badgeSegmentDecode(label)
		message = badgeSegmentDecode(message)

		// Query params
		q := r.URL.Query()
		style := q.Get("style")
		if style == "" {
			style = "flat"
		}
		labelColorRaw := q.Get("labelColor")
		if labelColorRaw == "" {
			labelColorRaw = "grey"
		}

		msgColor := resolveColor(colorRaw)
		labelColor := resolveColor(labelColorRaw)

		// Fetch logo from simple-icons CDN if requested.
		logo := q.Get("logo")
		logoColor := q.Get("logoColor")
		var logoSVG string
		if logo != "" {
			logoSVG = fetchSimpleIcon(logo, logoColor)
		}

		p := badgeParams{
			label:      label,
			message:    message,
			labelColor: labelColor,
			msgColor:   msgColor,
			style:      style,
			logoSVG:    logoSVG,
		}

		var svg string
		switch style {
		case "flat-square":
			svg = renderFlatSquare(p)
		case "plastic":
			svg = renderPlastic(p)
		case "for-the-badge":
			svg = renderForTheBadge(p)
		case "social":
			svg = renderSocial(p)
		default: // "flat" and anything unrecognised
			svg = renderFlat(p)
		}

		w.Header().Set("Content-Type", "image/svg+xml")
		w.Header().Set("Cache-Control", "public, max-age=3600, s-maxage=86400")
		w.Header().Set("X-Content-Type-Options", "nosniff")
		fmt.Fprint(w, svg)
	}
}
