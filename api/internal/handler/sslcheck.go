package handler

import (
	"crypto/sha256"
	"crypto/tls"
	"crypto/x509"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"net"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/n1rna/1two/api/internal/config"
)

// sslCacheTTL is how long a parsed SSL result is considered fresh.
const sslCacheTTL = 5 * time.Minute

// sslDialTimeout is the deadline for establishing the TLS connection.
const sslDialTimeout = 10 * time.Second

// ----- request / response types -----

type sslCheckRequest struct {
	Domain         string `json:"domain"`
	TurnstileToken string `json:"turnstileToken"`
}

// sslCertInfo holds the parsed details of a single certificate in the chain.
type sslCertInfo struct {
	Subject            string   `json:"subject"`
	Issuer             string   `json:"issuer"`
	SerialNumber       string   `json:"serialNumber"`
	NotBefore          string   `json:"notBefore"`
	NotAfter           string   `json:"notAfter"`
	DNSNames           []string `json:"dnsNames"`
	IsCA               bool     `json:"isCA"`
	SignatureAlgorithm string   `json:"signatureAlgorithm"`
	PublicKeyAlgorithm string   `json:"publicKeyAlgorithm"`
	Fingerprint        string   `json:"fingerprint"`
}

// sslCheckResponse is returned on a successful check.
type sslCheckResponse struct {
	Domain       string        `json:"domain"`
	Certificates []sslCertInfo `json:"certificates"`
	Protocol     string        `json:"protocol"`
	Cipher       string        `json:"cipher"`
	CheckedAt    time.Time     `json:"checkedAt"`
	Cached       bool          `json:"cached"`
	Error        string        `json:"error,omitempty"`
}

// ----- in-memory cache -----

type sslCacheEntry struct {
	result    sslCheckResponse
	expiresAt time.Time
}

// sslCache stores parsed results keyed by the domain string.
var sslCache sync.Map

// sslCacheGet returns the cached result and true if a valid (non-expired) entry
// exists for the given domain.
func sslCacheGet(domain string) (sslCheckResponse, bool) {
	v, ok := sslCache.Load(domain)
	if !ok {
		return sslCheckResponse{}, false
	}
	entry := v.(sslCacheEntry)
	if time.Now().After(entry.expiresAt) {
		sslCache.Delete(domain)
		return sslCheckResponse{}, false
	}
	return entry.result, true
}

// sslCacheSet stores a result in the cache with the configured TTL.
func sslCacheSet(domain string, result sslCheckResponse) {
	sslCache.Store(domain, sslCacheEntry{
		result:    result,
		expiresAt: time.Now().Add(sslCacheTTL),
	})
}

// ----- TLS helpers -----

// tlsVersionName maps a TLS version constant to a human-readable string.
func tlsVersionName(version uint16) string {
	switch version {
	case tls.VersionTLS10:
		return "TLS 1.0"
	case tls.VersionTLS11:
		return "TLS 1.1"
	case tls.VersionTLS12:
		return "TLS 1.2"
	case tls.VersionTLS13:
		return "TLS 1.3"
	default:
		return fmt.Sprintf("unknown (0x%04x)", version)
	}
}

// certFingerprint returns the SHA-256 fingerprint of a certificate as a
// colon-separated hex string (e.g. "AB:CD:...").
func certFingerprint(cert *x509.Certificate) string {
	sum := sha256.Sum256(cert.Raw)
	parts := make([]string, len(sum))
	for i, b := range sum {
		parts[i] = hex.EncodeToString([]byte{b})
	}
	return strings.ToUpper(strings.Join(parts, ":"))
}

// parseCert converts an *x509.Certificate into the API response struct.
func parseCert(cert *x509.Certificate) sslCertInfo {
	dnsNames := cert.DNSNames
	if dnsNames == nil {
		dnsNames = []string{}
	}
	return sslCertInfo{
		Subject:            cert.Subject.String(),
		Issuer:             cert.Issuer.String(),
		SerialNumber:       cert.SerialNumber.String(),
		NotBefore:          cert.NotBefore.UTC().Format(time.RFC3339),
		NotAfter:           cert.NotAfter.UTC().Format(time.RFC3339),
		DNSNames:           dnsNames,
		IsCA:               cert.IsCA,
		SignatureAlgorithm: cert.SignatureAlgorithm.String(),
		PublicKeyAlgorithm: cert.PublicKeyAlgorithm.String(),
		Fingerprint:        certFingerprint(cert),
	}
}

// extractHostname strips scheme, path, query, and port from a raw domain input
// so that only the bare hostname remains.
func extractHostname(raw string) string {
	s := strings.TrimSpace(raw)

	// Strip scheme if present.
	if idx := strings.Index(s, "://"); idx != -1 {
		s = s[idx+3:]
	}

	// Strip everything from the first slash onward (path / query / fragment).
	if idx := strings.IndexByte(s, '/'); idx != -1 {
		s = s[:idx]
	}

	// Strip port if present.
	if host, _, err := net.SplitHostPort(s); err == nil {
		s = host
	}

	return strings.ToLower(strings.TrimSpace(s))
}

// ----- main fetch logic -----

// classifyDialError returns a user-friendly error message for common TLS dial failures.
func classifyDialError(domain string, err error) string {
	msg := err.Error()
	switch {
	case strings.Contains(msg, "no such host"):
		return fmt.Sprintf("Domain %q does not exist or has no DNS records", domain)
	case strings.Contains(msg, "connection refused"):
		return fmt.Sprintf("Connection refused - %s does not appear to have an HTTPS server on port 443", domain)
	case strings.Contains(msg, "i/o timeout") || strings.Contains(msg, "deadline exceeded"):
		return fmt.Sprintf("Connection timed out - %s did not respond on port 443", domain)
	case strings.Contains(msg, "network is unreachable"):
		return fmt.Sprintf("Network unreachable when connecting to %s", domain)
	default:
		return fmt.Sprintf("Could not connect to %s: %s", domain, msg)
	}
}

// fetchSSLData dials domain:443, performs a TLS handshake, and returns the
// parsed certificate chain together with protocol and cipher information.
// It first tries a verified connection; if that fails with a certificate error
// it retries with InsecureSkipVerify to still return cert details alongside
// the verification error.
func fetchSSLData(domain string) (sslCheckResponse, error) {
	dialer := &net.Dialer{Timeout: sslDialTimeout}

	// First try: verified connection.
	conn, err := tls.DialWithDialer(dialer, "tcp", domain+":443", &tls.Config{
		ServerName: domain,
	})
	if err == nil {
		defer conn.Close()
		return buildSSLResponse(domain, conn.ConnectionState(), ""), nil
	}

	// Check if it's a network-level error (DNS, timeout, refused) - no point retrying.
	if isNetworkError(err) {
		return sslCheckResponse{}, fmt.Errorf("%s", classifyDialError(domain, err))
	}

	// Second try: skip verification to still surface cert details.
	conn2, err2 := tls.DialWithDialer(dialer, "tcp", domain+":443", &tls.Config{
		ServerName:         domain,
		InsecureSkipVerify: true, //nolint:gosec // intentional: fallback to show cert info
	})
	if err2 != nil {
		return sslCheckResponse{}, fmt.Errorf("%s", classifyDialError(domain, err))
	}
	defer conn2.Close()

	// Return the cert info with the original verification error.
	verifyErr := classifyCertError(err)
	return buildSSLResponse(domain, conn2.ConnectionState(), verifyErr), nil
}

// isNetworkError returns true when the error is a DNS / connectivity problem
// rather than a TLS certificate issue.
func isNetworkError(err error) bool {
	msg := err.Error()
	return strings.Contains(msg, "no such host") ||
		strings.Contains(msg, "connection refused") ||
		strings.Contains(msg, "i/o timeout") ||
		strings.Contains(msg, "deadline exceeded") ||
		strings.Contains(msg, "network is unreachable")
}

// classifyCertError returns a user-friendly description of a TLS verification failure.
func classifyCertError(err error) string {
	msg := err.Error()
	switch {
	case strings.Contains(msg, "certificate has expired"):
		return "Certificate has expired"
	case strings.Contains(msg, "certificate signed by unknown authority"):
		return "Certificate signed by unknown authority (self-signed or untrusted CA)"
	case strings.Contains(msg, "certificate is not valid"):
		return "Certificate is not valid for this domain"
	case strings.Contains(msg, "certificate is not trusted"):
		return "Certificate is not trusted"
	default:
		return fmt.Sprintf("Certificate verification failed: %s", msg)
	}
}

func buildSSLResponse(domain string, state tls.ConnectionState, verifyError string) sslCheckResponse {
	certs := make([]sslCertInfo, 0, len(state.PeerCertificates))
	for _, cert := range state.PeerCertificates {
		certs = append(certs, parseCert(cert))
	}

	return sslCheckResponse{
		Domain:       domain,
		Certificates: certs,
		Protocol:     tlsVersionName(state.Version),
		Cipher:       tls.CipherSuiteName(state.CipherSuite),
		CheckedAt:    time.Now().UTC(),
		Cached:       false,
		Error:        verifyError,
	}
}

// ----- handler -----

// SslCheck returns an http.HandlerFunc that validates a Cloudflare Turnstile
// token, optionally serves a cached result, and otherwise connects to the
// requested domain and inspects its TLS certificate chain.
func SslCheck(cfg *config.Config) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var req sslCheckRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid JSON body"})
			return
		}

		domain := extractHostname(req.Domain)
		if domain == "" {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "domain is required"})
			return
		}

		if req.TurnstileToken == "" {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "turnstileToken is required"})
			return
		}

		ctx := r.Context()

		valid, err := verifyTurnstile(ctx, cfg.TurnstileSecretKey, req.TurnstileToken)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "turnstile verification failed"})
			return
		}
		if !valid {
			writeJSON(w, http.StatusForbidden, map[string]string{"error": "invalid or expired turnstile token"})
			return
		}

		// Authenticated users always get fresh results.
		authenticated := r.Header.Get("X-User-Id") != ""

		// Return cached result if available (anonymous users only).
		if !authenticated {
			if cached, ok := sslCacheGet(domain); ok {
				cached.Cached = true
				writeJSON(w, http.StatusOK, cached)
				return
			}
		}

		result, err := fetchSSLData(domain)
		if err != nil {
			writeJSON(w, http.StatusBadGateway, map[string]string{"error": err.Error()})
			return
		}

		sslCacheSet(domain, result)
		writeJSON(w, http.StatusOK, result)
	}
}
