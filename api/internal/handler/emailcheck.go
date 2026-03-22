package handler

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/miekg/dns"
	"github.com/n1rna/1tt/api/internal/config"
)

// emailCheckCacheTTL is how long an email-check result is considered fresh.
const emailCheckCacheTTL = 5 * time.Minute

// mtaSTSHTTPTimeout is the deadline for fetching the MTA-STS policy file.
const mtaSTSHTTPTimeout = 3 * time.Second

// dkimSelectors is the list of common DKIM selectors tried during the check.
var dkimSelectors = []string{
	"google", "default", "selector1", "selector2",
	"k1", "dkim", "mail", "s1", "s2",
}

// ----- request / response types -----

type emailCheckRequest struct {
	Domain         string `json:"domain"`
	TurnstileToken string `json:"turnstileToken"`
}

type emailCheckResponse struct {
	Domain    string       `json:"domain"`
	Score     int          `json:"score"`
	Checks    []emailCheck `json:"checks"`
	CheckedAt time.Time    `json:"checkedAt"`
	Cached    bool         `json:"cached"`
}

type emailCheck struct {
	Name    string      `json:"name"`
	Status  string      `json:"status"` // "pass", "warn", "fail", "info"
	Title   string      `json:"title"`
	Details string      `json:"details"`
	Data    interface{} `json:"data,omitempty"`
}

// ----- in-memory cache -----

type emailCacheEntry struct {
	result    emailCheckResponse
	expiresAt time.Time
}

var emailCache sync.Map

func emailCacheGet(domain string) (emailCheckResponse, bool) {
	v, ok := emailCache.Load(domain)
	if !ok {
		return emailCheckResponse{}, false
	}
	entry := v.(emailCacheEntry)
	if time.Now().After(entry.expiresAt) {
		emailCache.Delete(domain)
		return emailCheckResponse{}, false
	}
	return entry.result, true
}

func emailCacheSet(domain string, result emailCheckResponse) {
	emailCache.Store(domain, emailCacheEntry{
		result:    result,
		expiresAt: time.Now().Add(emailCheckCacheTTL),
	})
}

// ----- per-check data shapes -----

type mxCheckData struct {
	Records []mxEntry `json:"records"`
}

type mxEntry struct {
	Host     string   `json:"host"`
	Priority uint16   `json:"priority"`
	IPs      []string `json:"ips"`
}

type spfCheckData struct {
	Record     string   `json:"record"`
	Mechanisms []string `json:"mechanisms"`
}

type dkimCheckData struct {
	FoundSelectors []string `json:"foundSelectors"`
	TriedSelectors []string `json:"triedSelectors"`
}

type dmarcCheckData struct {
	Record string `json:"record"`
	Policy string `json:"policy"`
	Rua    string `json:"rua,omitempty"`
	Ruf    string `json:"ruf,omitempty"`
	Pct    string `json:"pct,omitempty"`
	Sp     string `json:"sp,omitempty"`
}

type rdnsCheckData struct {
	Results []rdnsEntry `json:"results"`
}

type rdnsEntry struct {
	IP  string   `json:"ip"`
	PTR []string `json:"ptr"`
}

type mtaSTSCheckData struct {
	DNSRecord string `json:"dnsRecord"`
	Mode      string `json:"mode,omitempty"`
	Policy    string `json:"policy,omitempty"`
}

// ----- DNS helpers -----

// txtRecords extracts all joined TXT strings from a DNS reply.
func txtRecords(reply *dns.Msg) []string {
	var out []string
	for _, rr := range reply.Answer {
		if txt, ok := rr.(*dns.TXT); ok {
			out = append(out, strings.Join(txt.Txt, ""))
		}
	}
	return out
}

// aRecords extracts all A/AAAA addresses from a DNS reply.
func aRecords(reply *dns.Msg) []string {
	var out []string
	for _, rr := range reply.Answer {
		switch v := rr.(type) {
		case *dns.A:
			out = append(out, v.A.String())
		case *dns.AAAA:
			out = append(out, v.AAAA.String())
		}
	}
	return out
}

// parseDMARCTag extracts the value of a tag like "p=" from a DMARC record.
func parseDMARCTag(record, tag string) string {
	for _, part := range strings.Split(record, ";") {
		part = strings.TrimSpace(part)
		if strings.HasPrefix(strings.ToLower(part), strings.ToLower(tag)+"=") {
			return strings.TrimSpace(part[len(tag)+1:])
		}
	}
	return ""
}

// ----- individual check functions -----

// checkMX queries MX records and resolves each host to A records.
// Returns the check result and a score contribution (0, 20, or 25).
func checkMX(ctx context.Context, fqdn string) (emailCheck, int, []mxEntry) {
	reply, err := queryDNS(ctx, fqdn, dns.TypeMX)
	if err != nil {
		return emailCheck{
			Name:    "MX",
			Status:  "fail",
			Title:   "No MX records found",
			Details: "DNS query for MX records failed or returned no results. Mail cannot be delivered to this domain.",
			Data:    mxCheckData{Records: []mxEntry{}},
		}, 0, nil
	}

	var entries []mxEntry
	for _, rr := range reply.Answer {
		mx, ok := rr.(*dns.MX)
		if !ok {
			continue
		}
		host := strings.TrimSuffix(mx.Mx, ".")
		var ips []string
		if aReply, err := queryDNS(ctx, dns.Fqdn(host), dns.TypeA); err == nil {
			ips = append(ips, aRecords(aReply)...)
		}
		if aaaaReply, err := queryDNS(ctx, dns.Fqdn(host), dns.TypeAAAA); err == nil {
			ips = append(ips, aRecords(aaaaReply)...)
		}
		entries = append(entries, mxEntry{
			Host:     host,
			Priority: mx.Preference,
			IPs:      ips,
		})
	}

	data := mxCheckData{Records: entries}
	if len(entries) == 0 {
		return emailCheck{
			Name:    "MX",
			Status:  "fail",
			Title:   "No MX records found",
			Details: "No MX records exist for this domain. Email cannot be delivered here.",
			Data:    data,
		}, 0, nil
	}
	if len(entries) == 1 {
		return emailCheck{
			Name:    "MX",
			Status:  "warn",
			Title:   fmt.Sprintf("Single MX record (%s)", entries[0].Host),
			Details: "Only one MX record found. A second MX at a different host improves redundancy — if the primary server is down, mail delivery will fail.",
			Data:    data,
		}, 20, entries
	}
	return emailCheck{
		Name:    "MX",
		Status:  "pass",
		Title:   fmt.Sprintf("%d MX records configured", len(entries)),
		Details: "Multiple MX records provide redundancy for mail delivery.",
		Data:    data,
	}, 25, entries
}

// checkSPF queries TXT records and validates the SPF policy.
// Returns the check result and a score contribution (0, 10, 15, or 20).
func checkSPF(ctx context.Context, fqdn string) (emailCheck, int) {
	reply, err := queryDNS(ctx, fqdn, dns.TypeTXT)
	if err != nil {
		return emailCheck{
			Name:    "SPF",
			Status:  "fail",
			Title:   "No SPF record found",
			Details: "No TXT record beginning with \"v=spf1\" was found. Without SPF, receiving servers cannot verify that mail claiming to be from your domain was sent by an authorised server.",
		}, 0
	}

	var spfRecords []string
	for _, txt := range txtRecords(reply) {
		if strings.HasPrefix(txt, "v=spf1") {
			spfRecords = append(spfRecords, txt)
		}
	}

	if len(spfRecords) == 0 {
		return emailCheck{
			Name:    "SPF",
			Status:  "fail",
			Title:   "No SPF record found",
			Details: "No TXT record beginning with \"v=spf1\" was found. Without SPF, receiving servers cannot verify that mail claiming to be from your domain was sent by an authorised server.",
		}, 0
	}

	if len(spfRecords) > 1 {
		return emailCheck{
			Name:    "SPF",
			Status:  "warn",
			Title:   "Multiple SPF records found",
			Details: "More than one \"v=spf1\" TXT record was found. RFC 7208 requires exactly one — having multiple causes unpredictable behaviour and some receivers will reject mail.",
			Data: spfCheckData{
				Record:     strings.Join(spfRecords, " | "),
				Mechanisms: strings.Fields(spfRecords[0]),
			},
		}, 10
	}

	record := spfRecords[0]
	mechanisms := strings.Fields(record)

	data := spfCheckData{
		Record:     record,
		Mechanisms: mechanisms,
	}

	// Check for overly permissive +all.
	if strings.Contains(record, "+all") {
		return emailCheck{
			Name:    "SPF",
			Status:  "warn",
			Title:   "SPF record uses +all (permits everyone)",
			Details: "+all means any server is authorised to send mail for this domain, making SPF useless as a protection mechanism. Use -all (hard fail) or ~all (soft fail) instead.",
			Data:    data,
		}, 10
	}

	// Check for strict all qualifier.
	hasStrictAll := strings.Contains(record, "-all") || strings.Contains(record, "~all")
	if !hasStrictAll {
		return emailCheck{
			Name:    "SPF",
			Status:  "warn",
			Title:   "SPF record has no explicit all qualifier",
			Details: "The SPF record does not end with -all or ~all. Without an explicit reject/softfail qualifier, some receivers may treat unmatched senders as neutral. Add \"-all\" to hard-fail unauthorised senders.",
			Data:    data,
		}, 15
	}

	qualifier := "~all (softfail)"
	if strings.Contains(record, "-all") {
		qualifier = "-all (hard fail)"
	}

	return emailCheck{
		Name:    "SPF",
		Status:  "pass",
		Title:   fmt.Sprintf("SPF record present with %s", qualifier),
		Details: "A valid SPF record was found with a strict all qualifier. Receiving servers can use this to reject mail from unauthorised senders.",
		Data:    data,
	}, 20
}

// checkDKIM probes common DKIM selectors and reports which ones exist.
// Returns the check result and a score contribution (0 or 15).
func checkDKIM(ctx context.Context, domain string) (emailCheck, int) {
	var found []string
	var mu sync.Mutex
	var wg sync.WaitGroup

	for _, sel := range dkimSelectors {
		wg.Add(1)
		sel := sel
		go func() {
			defer wg.Done()
			name := dns.Fqdn(sel + "._domainkey." + domain)
			reply, err := queryDNS(ctx, name, dns.TypeTXT)
			if err != nil {
				return
			}
			for _, txt := range txtRecords(reply) {
				if strings.Contains(txt, "v=DKIM1") || strings.Contains(txt, "p=") {
					mu.Lock()
					found = append(found, sel)
					mu.Unlock()
					return
				}
			}
		}()
	}
	wg.Wait()

	data := dkimCheckData{
		FoundSelectors: found,
		TriedSelectors: dkimSelectors,
	}

	if len(found) == 0 {
		return emailCheck{
			Name:    "DKIM",
			Status:  "warn",
			Title:   "No DKIM records found for common selectors",
			Details: fmt.Sprintf("Checked %d common selectors (%s) — none returned a DKIM TXT record. DKIM may still be configured with a custom selector not checked here, or it may not be set up.", len(dkimSelectors), strings.Join(dkimSelectors, ", ")),
			Data:    data,
		}, 0
	}

	return emailCheck{
		Name:    "DKIM",
		Status:  "pass",
		Title:   fmt.Sprintf("DKIM found on selector(s): %s", strings.Join(found, ", ")),
		Details: "At least one DKIM public key record was found. Receiving servers can use this to verify the cryptographic signature on incoming mail.",
		Data:    data,
	}, 15
}

// checkDMARC queries the _dmarc subdomain and parses the policy record.
// Returns the check result and a score contribution (0, 8, 15, or 20).
func checkDMARC(ctx context.Context, fqdn, domain string) (emailCheck, int) {
	_ = fqdn // kept for symmetry; we build the name from domain directly
	name := dns.Fqdn("_dmarc." + domain)
	reply, err := queryDNS(ctx, name, dns.TypeTXT)
	if err != nil {
		return emailCheck{
			Name:    "DMARC",
			Status:  "fail",
			Title:   "No DMARC record found",
			Details: "No TXT record was found at _dmarc." + domain + ". Without DMARC, you cannot instruct receiving servers what to do with mail that fails SPF/DKIM checks, and you get no aggregate reports about mail sent in your name.",
		}, 0
	}

	var dmarcRecord string
	for _, txt := range txtRecords(reply) {
		if strings.HasPrefix(txt, "v=DMARC1") {
			dmarcRecord = txt
			break
		}
	}

	if dmarcRecord == "" {
		return emailCheck{
			Name:    "DMARC",
			Status:  "fail",
			Title:   "No DMARC record found",
			Details: "No valid DMARC record (starting with \"v=DMARC1\") was found at _dmarc." + domain + ".",
		}, 0
	}

	policy := parseDMARCTag(dmarcRecord, "p")
	rua := parseDMARCTag(dmarcRecord, "rua")
	ruf := parseDMARCTag(dmarcRecord, "ruf")
	pct := parseDMARCTag(dmarcRecord, "pct")
	sp := parseDMARCTag(dmarcRecord, "sp")

	data := dmarcCheckData{
		Record: dmarcRecord,
		Policy: policy,
		Rua:    rua,
		Ruf:    ruf,
		Pct:    pct,
		Sp:     sp,
	}

	switch strings.ToLower(policy) {
	case "none":
		return emailCheck{
			Name:    "DMARC",
			Status:  "warn",
			Title:   "DMARC record present but policy is p=none (monitor only)",
			Details: "p=none means DMARC is in monitoring mode — failing messages are not rejected or quarantined. This is a good starting point but you should move to p=quarantine or p=reject once you are confident your legitimate mail passes.",
			Data:    data,
		}, 8
	case "quarantine":
		return emailCheck{
			Name:    "DMARC",
			Status:  "pass",
			Title:   "DMARC configured with p=quarantine",
			Details: "Failing messages will be sent to the recipient's spam folder. For maximum protection consider upgrading to p=reject.",
			Data:    data,
		}, 15
	case "reject":
		return emailCheck{
			Name:    "DMARC",
			Status:  "pass",
			Title:   "DMARC configured with p=reject (best practice)",
			Details: "Receiving servers are instructed to outright reject messages that fail DMARC alignment. This provides the strongest protection against domain spoofing.",
			Data:    data,
		}, 20
	default:
		return emailCheck{
			Name:    "DMARC",
			Status:  "warn",
			Title:   fmt.Sprintf("DMARC record found but policy is unrecognised (%q)", policy),
			Details: "The DMARC record exists but contains an unrecognised policy value. Valid values are none, quarantine, and reject.",
			Data:    data,
		}, 8
	}
}

// checkBIMI looks for a BIMI record and returns an info-level check + bonus score.
func checkBIMI(ctx context.Context, domain string) (emailCheck, int) {
	name := dns.Fqdn("default._bimi." + domain)
	reply, err := queryDNS(ctx, name, dns.TypeTXT)
	if err != nil {
		return emailCheck{
			Name:    "BIMI",
			Status:  "info",
			Title:   "No BIMI record found",
			Details: "Brand Indicators for Message Identification (BIMI) lets you display a verified logo next to your emails in supported mail clients. Not yet widely required but beneficial for brand recognition.",
		}, 0
	}

	for _, txt := range txtRecords(reply) {
		if strings.HasPrefix(txt, "v=BIMI1") {
			return emailCheck{
				Name:    "BIMI",
				Status:  "pass",
				Title:   "BIMI record found",
				Details: "A BIMI record was found. Supporting mail clients may display your brand logo next to delivered messages.",
				Data:    map[string]string{"record": txt},
			}, 3
		}
	}

	return emailCheck{
		Name:    "BIMI",
		Status:  "info",
		Title:   "No BIMI record found",
		Details: "Brand Indicators for Message Identification (BIMI) lets you display a verified logo next to your emails in supported mail clients.",
	}, 0
}

// checkMTASTS queries the _mta-sts TXT record and, if present, fetches the
// policy file over HTTPS. Returns a check result and a score contribution
// (0, 3, or 5).
func checkMTASTS(ctx context.Context, domain string) (emailCheck, int) {
	name := dns.Fqdn("_mta-sts." + domain)
	reply, err := queryDNS(ctx, name, dns.TypeTXT)
	if err != nil {
		return emailCheck{
			Name:    "MTA-STS",
			Status:  "info",
			Title:   "No MTA-STS record found",
			Details: "MTA-STS (RFC 8461) lets you publish a policy requiring TLS for inbound mail. Without it, opportunistic TLS can be stripped by a man-in-the-middle attacker.",
		}, 0
	}

	var stsRecord string
	for _, txt := range txtRecords(reply) {
		if strings.HasPrefix(txt, "v=STSv1") {
			stsRecord = txt
			break
		}
	}

	if stsRecord == "" {
		return emailCheck{
			Name:    "MTA-STS",
			Status:  "info",
			Title:   "No MTA-STS record found",
			Details: "MTA-STS (RFC 8461) lets you publish a policy requiring TLS for inbound mail.",
		}, 0
	}

	data := mtaSTSCheckData{DNSRecord: stsRecord}

	// Fetch the policy file.
	policyURL := "https://mta-sts." + domain + "/.well-known/mta-sts.txt"
	httpCtx, cancel := context.WithTimeout(ctx, mtaSTSHTTPTimeout)
	defer cancel()

	req, err := http.NewRequestWithContext(httpCtx, http.MethodGet, policyURL, nil)
	if err == nil {
		resp, err := http.DefaultClient.Do(req)
		if err == nil {
			defer resp.Body.Close()
			if resp.StatusCode == http.StatusOK {
				buf := make([]byte, 4096)
				n, _ := resp.Body.Read(buf)
				policyText := string(buf[:n])
				data.Policy = policyText

				// Extract mode from policy body.
				for _, line := range strings.Split(policyText, "\n") {
					line = strings.TrimSpace(line)
					if strings.HasPrefix(line, "mode:") {
						data.Mode = strings.TrimSpace(strings.TrimPrefix(line, "mode:"))
						break
					}
				}
			}
		}
	}

	score := 3
	title := "MTA-STS DNS record found"
	details := "An MTA-STS DNS record exists."
	status := "warn"

	switch strings.ToLower(data.Mode) {
	case "enforce":
		score = 5
		title = "MTA-STS configured in enforce mode"
		details = "MTA-STS policy is in enforce mode — sending servers that support MTA-STS will require a valid TLS connection and will abort delivery rather than fall back to unencrypted transfer."
		status = "pass"
	case "testing":
		score = 3
		title = "MTA-STS configured in testing mode"
		details = "MTA-STS policy is in testing mode. Failures are reported but not enforced. Consider switching to enforce once you have validated your setup."
		status = "warn"
	case "none":
		score = 0
		title = "MTA-STS policy mode is none"
		details = "MTA-STS policy mode is set to none, which disables enforcement. Update the policy file to testing or enforce."
		status = "warn"
	default:
		if data.Policy == "" {
			title = "MTA-STS DNS record found but policy file unreachable"
			details = "The _mta-sts TXT record exists but the policy file at " + policyURL + " could not be fetched. Sending servers will be unable to enforce the policy."
		}
	}

	return emailCheck{
		Name:    "MTA-STS",
		Status:  status,
		Title:   title,
		Details: details,
		Data:    data,
	}, score
}

// checkTLSRPT queries the _smtp._tls TXT record for TLS-RPT configuration.
// Returns an info-level check and an optional bonus score of 2.
func checkTLSRPT(ctx context.Context, domain string) (emailCheck, int) {
	name := dns.Fqdn("_smtp._tls." + domain)
	reply, err := queryDNS(ctx, name, dns.TypeTXT)
	if err != nil {
		return emailCheck{
			Name:    "TLS-RPT",
			Status:  "info",
			Title:   "No TLS-RPT record found",
			Details: "TLS Reporting (RFC 8460) allows receiving servers to send you reports about TLS negotiation failures. Adding a _smtp._tls TXT record with v=TLSRPTv1 enables this reporting.",
		}, 0
	}

	for _, txt := range txtRecords(reply) {
		if strings.HasPrefix(txt, "v=TLSRPTv1") {
			return emailCheck{
				Name:    "TLS-RPT",
				Status:  "pass",
				Title:   "TLS-RPT record found",
				Details: "TLS Reporting is configured. Receiving servers that support RFC 8460 will send you aggregate reports about TLS connection failures.",
				Data:    map[string]string{"record": txt},
			}, 2
		}
	}

	return emailCheck{
		Name:    "TLS-RPT",
		Status:  "info",
		Title:   "No TLS-RPT record found",
		Details: "TLS Reporting (RFC 8460) allows receiving servers to send you reports about TLS negotiation failures.",
	}, 0
}

// checkReverseDNS performs PTR lookups for all IP addresses associated with
// the provided MX entries. Returns a check result and a score contribution
// (0–10, proportional to the fraction of IPs with PTR records).
func checkReverseDNS(ctx context.Context, mxEntries []mxEntry) (emailCheck, int) {
	if len(mxEntries) == 0 {
		return emailCheck{
			Name:    "Reverse DNS",
			Status:  "info",
			Title:   "Reverse DNS check skipped (no MX records)",
			Details: "PTR records cannot be checked because no MX records were found.",
		}, 0
	}

	// Collect all unique IPs from MX entries.
	var allIPs []string
	seen := make(map[string]bool)
	for _, entry := range mxEntries {
		for _, ip := range entry.IPs {
			if !seen[ip] {
				seen[ip] = true
				allIPs = append(allIPs, ip)
			}
		}
	}

	if len(allIPs) == 0 {
		return emailCheck{
			Name:    "Reverse DNS",
			Status:  "warn",
			Title:   "MX hosts did not resolve to any IP addresses",
			Details: "The MX records could not be resolved to IP addresses, so PTR record checks were skipped.",
			Data:    rdnsCheckData{Results: []rdnsEntry{}},
		}, 0
	}

	type result struct {
		ip  string
		ptr []string
	}

	resultCh := make(chan result, len(allIPs))
	var wg sync.WaitGroup

	for _, ip := range allIPs {
		wg.Add(1)
		ip := ip
		go func() {
			defer wg.Done()
			arpa, err := dns.ReverseAddr(ip)
			if err != nil {
				resultCh <- result{ip: ip, ptr: nil}
				return
			}
			reply, err := queryDNS(ctx, arpa, dns.TypePTR)
			if err != nil {
				resultCh <- result{ip: ip, ptr: nil}
				return
			}
			var ptrs []string
			for _, rr := range reply.Answer {
				if ptr, ok := rr.(*dns.PTR); ok {
					ptrs = append(ptrs, strings.TrimSuffix(ptr.Ptr, "."))
				}
			}
			resultCh <- result{ip: ip, ptr: ptrs}
		}()
	}

	wg.Wait()
	close(resultCh)

	var entries []rdnsEntry
	withPTR := 0
	for res := range resultCh {
		if res.ptr == nil {
			res.ptr = []string{}
		}
		entries = append(entries, rdnsEntry{IP: res.ip, PTR: res.ptr})
		if len(res.ptr) > 0 {
			withPTR++
		}
	}

	data := rdnsCheckData{Results: entries}

	// Score: 10 × (fraction of IPs with PTR), rounded.
	score := 0
	if len(allIPs) > 0 {
		score = int(float64(withPTR) / float64(len(allIPs)) * 10)
	}

	switch {
	case withPTR == 0:
		return emailCheck{
			Name:    "Reverse DNS",
			Status:  "warn",
			Title:   "No PTR records found for MX server IPs",
			Details: fmt.Sprintf("Checked %d IP address(es) — none had a PTR record. Many receiving servers use PTR lookups as a spam signal; missing PTR records may cause mail to be flagged.", len(allIPs)),
			Data:    data,
		}, 0
	case withPTR < len(allIPs):
		return emailCheck{
			Name:    "Reverse DNS",
			Status:  "warn",
			Title:   fmt.Sprintf("PTR records found for %d of %d MX server IPs", withPTR, len(allIPs)),
			Details: "Some MX server IPs are missing PTR records. Ensure all mail server IPs have forward-confirmed PTR (FCrDNS) records.",
			Data:    data,
		}, score
	default:
		return emailCheck{
			Name:    "Reverse DNS",
			Status:  "pass",
			Title:   fmt.Sprintf("PTR records present for all %d MX server IP(s)", len(allIPs)),
			Details: "All MX server IPs resolve to PTR records, which is a positive signal for mail deliverability.",
			Data:    data,
		}, 10
	}
}

// ----- main fetch logic -----

// fetchEmailData runs all email-deliverability checks concurrently and
// aggregates the results into an emailCheckResponse.
func fetchEmailData(domain string) emailCheckResponse {
	fqdn := dns.Fqdn(domain)

	// Use a timeout context shared across all checks.
	ctx, cancel := context.WithTimeout(context.Background(), 20*time.Second)
	defer cancel()

	// We need MX results before running the reverse DNS check, so we handle
	// MX first in its own goroutine and block on it.
	type mxResult struct {
		check   emailCheck
		score   int
		entries []mxEntry
	}

	type checkResult struct {
		check emailCheck
		score int
	}

	mxCh := make(chan mxResult, 1)
	spfCh := make(chan checkResult, 1)
	dkimCh := make(chan checkResult, 1)
	dmarcCh := make(chan checkResult, 1)
	bimiCh := make(chan checkResult, 1)
	mtaStsCh := make(chan checkResult, 1)
	tlsRptCh := make(chan checkResult, 1)

	go func() {
		c, s, entries := checkMX(ctx, fqdn)
		mxCh <- mxResult{c, s, entries}
	}()
	go func() {
		c, s := checkSPF(ctx, fqdn)
		spfCh <- checkResult{c, s}
	}()
	go func() {
		c, s := checkDKIM(ctx, domain)
		dkimCh <- checkResult{c, s}
	}()
	go func() {
		c, s := checkDMARC(ctx, fqdn, domain)
		dmarcCh <- checkResult{c, s}
	}()
	go func() {
		c, s := checkBIMI(ctx, domain)
		bimiCh <- checkResult{c, s}
	}()
	go func() {
		c, s := checkMTASTS(ctx, domain)
		mtaStsCh <- checkResult{c, s}
	}()
	go func() {
		c, s := checkTLSRPT(ctx, domain)
		tlsRptCh <- checkResult{c, s}
	}()

	// Collect primary checks.
	mx := <-mxCh
	spf := <-spfCh
	dkim := <-dkimCh
	dmarc := <-dmarcCh
	bimi := <-bimiCh
	mtaSts := <-mtaStsCh
	tlsRpt := <-tlsRptCh

	// Reverse DNS depends on MX results.
	rdnsCheck, rdnsScore := checkReverseDNS(ctx, mx.entries)

	score := mx.score + spf.score + dkim.score + dmarc.score +
		rdnsScore + mtaSts.score + bimi.score + tlsRpt.score

	// Cap at 100.
	if score > 100 {
		score = 100
	}

	checks := []emailCheck{
		mx.check,
		spf.check,
		dkim.check,
		dmarc.check,
		rdnsCheck,
		mtaSts.check,
		bimi.check,
		tlsRpt.check,
	}

	return emailCheckResponse{
		Domain:    domain,
		Score:     score,
		Checks:    checks,
		CheckedAt: time.Now().UTC(),
		Cached:    false,
	}
}

// ----- handler -----

// EmailCheck returns an http.HandlerFunc that validates a Cloudflare Turnstile
// token, optionally serves a cached result, and otherwise runs a comprehensive
// suite of email deliverability checks against the requested domain.
func EmailCheck(cfg *config.Config) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var req emailCheckRequest
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
			if cached, ok := emailCacheGet(domain); ok {
				cached.Cached = true
				writeJSON(w, http.StatusOK, cached)
				return
			}
		}

		result := fetchEmailData(domain)

		emailCacheSet(domain, result)
		writeJSON(w, http.StatusOK, result)
	}
}
