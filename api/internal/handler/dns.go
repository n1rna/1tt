package handler

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/miekg/dns"
	"github.com/n1rna/1two/api/internal/config"
)

// dnsServer is the resolver used for all lookups.
const dnsServer = "1.1.1.1:53"

// supportedTypes is the set of record type strings the endpoint accepts.
var supportedTypes = map[string]uint16{
	"A":     dns.TypeA,
	"AAAA":  dns.TypeAAAA,
	"CNAME": dns.TypeCNAME,
	"MX":    dns.TypeMX,
	"TXT":   dns.TypeTXT,
	"NS":    dns.TypeNS,
	"SOA":   dns.TypeSOA,
	"SRV":   dns.TypeSRV,
	"CAA":   dns.TypeCAA,
	"PTR":   dns.TypePTR,
}

// dnsLookupRequest is the expected POST body.
type dnsLookupRequest struct {
	Domain        string `json:"domain"`
	Type          string `json:"type"`
	TurnstileToken string `json:"turnstileToken"`
}

// dnsLookupResponse is the successful response envelope.
type dnsLookupResponse struct {
	Domain     string      `json:"domain"`
	Type       string      `json:"type"`
	Records    interface{} `json:"records"`
	TTL        uint32      `json:"ttl"`
	ResolvedAt time.Time   `json:"resolvedAt"`
}

// mxRecord is the per-entry shape returned for MX queries.
type mxRecord struct {
	Host     string `json:"host"`
	Priority uint16 `json:"priority"`
}

// soaRecord is the per-entry shape returned for SOA queries.
type soaRecord struct {
	NS      string `json:"ns"`
	MBox    string `json:"mbox"`
	Serial  uint32 `json:"serial"`
	Refresh uint32 `json:"refresh"`
	Retry   uint32 `json:"retry"`
	Expire  uint32 `json:"expire"`
	MinTTL  uint32 `json:"minttl"`
}

// srvRecord is the per-entry shape returned for SRV queries.
type srvRecord struct {
	Target   string `json:"target"`
	Port     uint16 `json:"port"`
	Priority uint16 `json:"priority"`
	Weight   uint16 `json:"weight"`
}

// caaRecord is the per-entry shape returned for CAA queries.
type caaRecord struct {
	Flag  uint8  `json:"flag"`
	Tag   string `json:"tag"`
	Value string `json:"value"`
}

// turnstileVerifyResponse mirrors the Cloudflare siteverify JSON response.
type turnstileVerifyResponse struct {
	Success bool     `json:"success"`
	Codes   []string `json:"error-codes"`
}

// verifyTurnstile calls the Cloudflare Turnstile siteverify endpoint and returns
// whether the supplied token is valid. A non-nil error indicates a transport or
// decoding problem, not a validation failure; callers must check the bool too.
func verifyTurnstile(ctx context.Context, secretKey, token string) (bool, error) {
	body, _ := json.Marshal(map[string]string{
		"secret":   secretKey,
		"response": token,
	})

	req, err := http.NewRequestWithContext(
		ctx,
		http.MethodPost,
		"https://challenges.cloudflare.com/turnstile/v0/siteverify",
		bytes.NewReader(body),
	)
	if err != nil {
		return false, fmt.Errorf("building turnstile request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return false, fmt.Errorf("calling turnstile API: %w", err)
	}
	defer resp.Body.Close()

	var result turnstileVerifyResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return false, fmt.Errorf("decoding turnstile response: %w", err)
	}

	return result.Success, nil
}

// queryDNS sends a DNS query for the given FQDN and record type to dnsServer,
// using the provided context for timeout/cancellation.
func queryDNS(ctx context.Context, fqdn string, qtype uint16) (*dns.Msg, error) {
	m := new(dns.Msg)
	m.SetQuestion(fqdn, qtype)
	m.RecursionDesired = true

	c := new(dns.Client)
	c.Timeout = 5 * time.Second

	// dns.ExchangeContext respects the context deadline.
	reply, _, err := c.ExchangeContext(ctx, m, dnsServer)
	if err != nil {
		return nil, fmt.Errorf("dns exchange: %w", err)
	}
	if reply.Rcode != dns.RcodeSuccess {
		return nil, fmt.Errorf("dns rcode %s", dns.RcodeToString[reply.Rcode])
	}

	return reply, nil
}

// parseRecords extracts typed records and the minimum observed TTL from a reply.
func parseRecords(reply *dns.Msg, typeName string) (interface{}, uint32) {
	var minTTL uint32 = 0
	first := true

	trackTTL := func(ttl uint32) {
		if first || ttl < minTTL {
			minTTL = ttl
			first = false
		}
	}

	switch typeName {
	case "MX":
		var out []mxRecord
		for _, rr := range reply.Answer {
			if mx, ok := rr.(*dns.MX); ok {
				trackTTL(mx.Hdr.Ttl)
				out = append(out, mxRecord{
					Host:     strings.TrimSuffix(mx.Mx, "."),
					Priority: mx.Preference,
				})
			}
		}
		return out, minTTL

	case "SOA":
		var out []soaRecord
		for _, rr := range reply.Answer {
			if soa, ok := rr.(*dns.SOA); ok {
				trackTTL(soa.Hdr.Ttl)
				out = append(out, soaRecord{
					NS:      strings.TrimSuffix(soa.Ns, "."),
					MBox:    strings.TrimSuffix(soa.Mbox, "."),
					Serial:  soa.Serial,
					Refresh: soa.Refresh,
					Retry:   soa.Retry,
					Expire:  soa.Expire,
					MinTTL:  soa.Minttl,
				})
			}
		}
		return out, minTTL

	case "SRV":
		var out []srvRecord
		for _, rr := range reply.Answer {
			if srv, ok := rr.(*dns.SRV); ok {
				trackTTL(srv.Hdr.Ttl)
				out = append(out, srvRecord{
					Target:   strings.TrimSuffix(srv.Target, "."),
					Port:     srv.Port,
					Priority: srv.Priority,
					Weight:   srv.Weight,
				})
			}
		}
		return out, minTTL

	case "CAA":
		var out []caaRecord
		for _, rr := range reply.Answer {
			if caa, ok := rr.(*dns.CAA); ok {
				trackTTL(caa.Hdr.Ttl)
				out = append(out, caaRecord{
					Flag:  caa.Flag,
					Tag:   caa.Tag,
					Value: caa.Value,
				})
			}
		}
		return out, minTTL

	case "TXT":
		var out []string
		for _, rr := range reply.Answer {
			if txt, ok := rr.(*dns.TXT); ok {
				trackTTL(txt.Hdr.Ttl)
				out = append(out, strings.Join(txt.Txt, ""))
			}
		}
		return out, minTTL

	case "CNAME":
		var out []string
		for _, rr := range reply.Answer {
			if cname, ok := rr.(*dns.CNAME); ok {
				trackTTL(cname.Hdr.Ttl)
				out = append(out, strings.TrimSuffix(cname.Target, "."))
			}
		}
		return out, minTTL

	case "NS":
		var out []string
		for _, rr := range reply.Answer {
			if ns, ok := rr.(*dns.NS); ok {
				trackTTL(ns.Hdr.Ttl)
				out = append(out, strings.TrimSuffix(ns.Ns, "."))
			}
		}
		return out, minTTL

	case "PTR":
		var out []string
		for _, rr := range reply.Answer {
			if ptr, ok := rr.(*dns.PTR); ok {
				trackTTL(ptr.Hdr.Ttl)
				out = append(out, strings.TrimSuffix(ptr.Ptr, "."))
			}
		}
		return out, minTTL

	default: // A and AAAA
		var out []string
		for _, rr := range reply.Answer {
			switch v := rr.(type) {
			case *dns.A:
				trackTTL(v.Hdr.Ttl)
				out = append(out, v.A.String())
			case *dns.AAAA:
				trackTTL(v.Hdr.Ttl)
				out = append(out, v.AAAA.String())
			}
		}
		return out, minTTL
	}
}

// writeJSON is a small helper that sets Content-Type and encodes v.
func writeJSON(w http.ResponseWriter, status int, v interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(v) //nolint:errcheck
}

// DNSLookup returns an http.HandlerFunc that validates a Cloudflare Turnstile
// token and then performs a DNS lookup using Cloudflare's public resolver.
func DNSLookup(cfg *config.Config) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var req dnsLookupRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid JSON body"})
			return
		}

		req.Domain = strings.TrimSpace(req.Domain)
		req.Type = strings.ToUpper(strings.TrimSpace(req.Type))

		if req.Domain == "" {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "domain is required"})
			return
		}

		qtype, ok := supportedTypes[req.Type]
		if !ok {
			writeJSON(w, http.StatusBadRequest, map[string]string{
				"error": fmt.Sprintf("unsupported record type %q; supported: A, AAAA, CNAME, MX, TXT, NS, SOA, SRV, CAA, PTR", req.Type),
			})
			return
		}

		if req.TurnstileToken == "" {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "turnstileToken is required"})
			return
		}

		// Use a single context with a generous timeout covering both the Turnstile
		// call and the subsequent DNS query.
		ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
		defer cancel()

		valid, err := verifyTurnstile(ctx, cfg.TurnstileSecretKey, req.TurnstileToken)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "turnstile verification failed"})
			return
		}
		if !valid {
			writeJSON(w, http.StatusForbidden, map[string]string{"error": "invalid or expired turnstile token"})
			return
		}

		// Ensure the domain is a valid FQDN for the dns library.
		fqdn := dns.Fqdn(req.Domain)

		reply, err := queryDNS(ctx, fqdn, qtype)
		if err != nil {
			writeJSON(w, http.StatusBadGateway, map[string]string{"error": err.Error()})
			return
		}

		records, ttl := parseRecords(reply, req.Type)

		writeJSON(w, http.StatusOK, dnsLookupResponse{
			Domain:     req.Domain,
			Type:       req.Type,
			Records:    records,
			TTL:        ttl,
			ResolvedAt: time.Now().UTC(),
		})
	}
}
