package handler

import (
	"encoding/json"
	"fmt"
	"io"
	"net"
	"net/http"
	"strings"
)

// resolveIP extracts the caller's real IP from request headers, falling back
// to RemoteAddr when proxy headers are absent.
func resolveIP(r *http.Request) string {
	if xff := r.Header.Get("X-Forwarded-For"); xff != "" {
		if idx := strings.Index(xff, ","); idx != -1 {
			return strings.TrimSpace(xff[:idx])
		}
		return strings.TrimSpace(xff)
	}

	if xri := r.Header.Get("X-Real-Ip"); xri != "" {
		return strings.TrimSpace(xri)
	}

	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		return r.RemoteAddr
	}
	return host
}

// isLocalIP returns true if the IP is a loopback or private address.
func isLocalIP(ip string) bool {
	parsed := net.ParseIP(ip)
	if parsed == nil {
		return ip == "localhost"
	}
	return parsed.IsLoopback() || parsed.IsPrivate() || parsed.IsUnspecified()
}

func fetchPublicIP(url string) string {
	resp, err := http.Get(url)
	if err != nil {
		return ""
	}
	defer resp.Body.Close()
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return ""
	}
	return strings.TrimSpace(string(body))
}

// getPublicIP returns the caller's IP, falling back to ipify
// when the resolved IP is a local/loopback address (e.g. during local dev).
func getPublicIP(r *http.Request) string {
	ip := resolveIP(r)
	if isLocalIP(ip) {
		if pub := fetchPublicIP("https://api.ipify.org"); pub != "" {
			return pub
		}
	}
	return ip
}

// IPAddress responds with the caller's IP address as plain text.
func IPAddress(w http.ResponseWriter, r *http.Request) {
	ip := getPublicIP(r)
	w.Header().Set("Content-Type", "text/plain")
	fmt.Fprintf(w, "%s\n", ip)
}

// IPAll returns both IPv4 and IPv6 addresses as JSON.
func IPAll(w http.ResponseWriter, r *http.Request) {
	ip := resolveIP(r)

	result := map[string]string{}

	if isLocalIP(ip) {
		// Local dev: fetch both from ipify
		if v4 := fetchPublicIP("https://api.ipify.org"); v4 != "" {
			result["ipv4"] = v4
		}
		if v6 := fetchPublicIP("https://api64.ipify.org"); v6 != "" {
			result["ipv6"] = v6
		}
	} else {
		// Production: we have the real client IP from the proxy
		parsed := net.ParseIP(ip)
		if parsed != nil && parsed.To4() != nil {
			result["ipv4"] = ip
		} else {
			result["ipv6"] = ip
		}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(result)
}

// IPInfo fetches geolocation data from ip-api.com and forwards it to the caller.
func IPInfo(w http.ResponseWriter, r *http.Request) {
	ip := getPublicIP(r)

	url := fmt.Sprintf(
		"http://ip-api.com/json/%s?fields=status,message,country,countryCode,region,regionName,city,zip,lat,lon,timezone,isp,org,as,query",
		ip,
	)

	resp, err := http.Get(url) //nolint:noctx
	if err != nil {
		fallback(w, ip)
		return
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		fallback(w, ip)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	w.Write(body) //nolint:errcheck
}

func fallback(w http.ResponseWriter, ip string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]string{"query": ip})
}
