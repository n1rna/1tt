"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { Search, Loader2, AlertCircle, ChevronDown } from "lucide-react";
import { Turnstile } from "@/components/ui/turnstile";

const RECORD_TYPES = ["A", "AAAA", "CNAME", "MX", "TXT", "NS", "SOA", "SRV", "CAA", "PTR"] as const;
type RecordType = (typeof RECORD_TYPES)[number];

// Backend response shape
interface DnsResponse {
  domain: string;
  type: string;
  records: unknown[];
  ttl: number;
  resolvedAt: string;
}

interface MxRecord {
  host: string;
  priority: number;
}

interface SoaRecord {
  ns: string;
  mbox: string;
  serial: number;
  refresh: number;
  retry: number;
  expire: number;
  minttl: number;
}

interface SrvRecord {
  target: string;
  port: number;
  priority: number;
  weight: number;
}

interface CaaRecord {
  flag: number;
  tag: string;
  value: string;
}

function ResultsTable({ data }: { data: DnsResponse }) {
  const { type, records, ttl } = data;

  if (!records || records.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-4 text-center">
        No {type} records found.
      </p>
    );
  }

  if (type === "SOA") {
    const soa = records[0] as SoaRecord;
    const fields = [
      ["Primary NS", soa.ns],
      ["Responsible", soa.mbox],
      ["Serial", soa.serial?.toString()],
      ["Refresh", `${soa.refresh}s`],
      ["Retry", `${soa.retry}s`],
      ["Expire", `${soa.expire}s`],
      ["Min TTL", `${soa.minttl}s`],
      ["TTL", `${ttl}s`],
    ];
    return (
      <div className="rounded-lg border border-border overflow-hidden">
        {fields.map(([label, value]) => (
          <div
            key={label}
            className="flex items-start gap-4 px-4 py-2.5 border-b border-border last:border-0 odd:bg-muted/30"
          >
            <span className="text-xs font-medium text-muted-foreground w-28 shrink-0 pt-0.5">
              {label}
            </span>
            <span className="text-sm font-mono break-all">{value}</span>
          </div>
        ))}
      </div>
    );
  }

  if (type === "MX") {
    const mxRecords = records as MxRecord[];
    return (
      <div className="rounded-lg border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted/50 text-left">
              <th className="px-4 py-2 text-xs font-medium text-muted-foreground">Priority</th>
              <th className="px-4 py-2 text-xs font-medium text-muted-foreground">Mail server</th>
              <th className="px-4 py-2 text-xs font-medium text-muted-foreground text-right">TTL</th>
            </tr>
          </thead>
          <tbody>
            {mxRecords.map((r, i) => (
              <tr key={i} className="border-t border-border hover:bg-muted/20 transition-colors">
                <td className="px-4 py-2.5 font-mono">{r.priority}</td>
                <td className="px-4 py-2.5 font-mono break-all">{r.host}</td>
                <td className="px-4 py-2.5 font-mono text-muted-foreground text-right">{ttl}s</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  if (type === "SRV") {
    const srvRecords = records as SrvRecord[];
    return (
      <div className="rounded-lg border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted/50 text-left">
              <th className="px-4 py-2 text-xs font-medium text-muted-foreground">Priority</th>
              <th className="px-4 py-2 text-xs font-medium text-muted-foreground">Weight</th>
              <th className="px-4 py-2 text-xs font-medium text-muted-foreground">Port</th>
              <th className="px-4 py-2 text-xs font-medium text-muted-foreground">Target</th>
              <th className="px-4 py-2 text-xs font-medium text-muted-foreground text-right">TTL</th>
            </tr>
          </thead>
          <tbody>
            {srvRecords.map((r, i) => (
              <tr key={i} className="border-t border-border hover:bg-muted/20 transition-colors">
                <td className="px-4 py-2.5 font-mono">{r.priority}</td>
                <td className="px-4 py-2.5 font-mono">{r.weight}</td>
                <td className="px-4 py-2.5 font-mono">{r.port}</td>
                <td className="px-4 py-2.5 font-mono break-all">{r.target}</td>
                <td className="px-4 py-2.5 font-mono text-muted-foreground text-right">{ttl}s</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  if (type === "CAA") {
    const caaRecords = records as CaaRecord[];
    return (
      <div className="rounded-lg border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted/50 text-left">
              <th className="px-4 py-2 text-xs font-medium text-muted-foreground">Flag</th>
              <th className="px-4 py-2 text-xs font-medium text-muted-foreground">Tag</th>
              <th className="px-4 py-2 text-xs font-medium text-muted-foreground">Value</th>
              <th className="px-4 py-2 text-xs font-medium text-muted-foreground text-right">TTL</th>
            </tr>
          </thead>
          <tbody>
            {caaRecords.map((r, i) => (
              <tr key={i} className="border-t border-border hover:bg-muted/20 transition-colors">
                <td className="px-4 py-2.5 font-mono">{r.flag}</td>
                <td className="px-4 py-2.5 font-mono">{r.tag}</td>
                <td className="px-4 py-2.5 font-mono break-all">{r.value}</td>
                <td className="px-4 py-2.5 font-mono text-muted-foreground text-right">{ttl}s</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  // A, AAAA, CNAME, TXT, NS, PTR — simple string arrays
  const stringRecords = records as string[];
  return (
    <div className="rounded-lg border border-border overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-muted/50 text-left">
            <th className="px-4 py-2 text-xs font-medium text-muted-foreground">Value</th>
            <th className="px-4 py-2 text-xs font-medium text-muted-foreground text-right">TTL</th>
          </tr>
        </thead>
        <tbody>
          {stringRecords.map((value, i) => (
            <tr key={i} className="border-t border-border hover:bg-muted/20 transition-colors">
              <td className="px-4 py-2.5 font-mono break-all">{value}</td>
              <td className="px-4 py-2.5 font-mono text-muted-foreground text-right">{ttl}s</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "";

export function DnsTool() {
  const [domain, setDomain] = useState("");
  const [recordType, setRecordType] = useState<RecordType>("A");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<DnsResponse | null>(null);
  const [selectOpen, setSelectOpen] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const selectRef = useRef<HTMLDivElement>(null);

  // Close custom select on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (selectRef.current && !selectRef.current.contains(e.target as Node)) {
        setSelectOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const handleLookup = useCallback(
    async (e?: React.FormEvent) => {
      e?.preventDefault();
      const trimmed = domain.trim().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
      if (!trimmed) return;

      setLoading(true);
      setError(null);
      setResult(null);

      try {
        if (!token) {
          setError("Please complete the verification challenge first.");
          setLoading(false);
          return;
        }

        const res = await fetch("/api/proxy/dns/lookup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ domain: trimmed, type: recordType, turnstileToken: token }),
        });

        setToken(null);

        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error((body as { error?: string }).error ?? `Request failed (${res.status})`);
        }

        const data = (await res.json()) as DnsResponse;
        setResult(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "An unexpected error occurred");
        setToken(null);
      } finally {
        setLoading(false);
      }
    },
    [domain, recordType, token]
  );

  return (
    <div className="space-y-6">
      {/* Input row */}
      <form onSubmit={handleLookup} className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <input
            type="text"
            value={domain}
            onChange={(e) => setDomain(e.target.value)}
            placeholder="example.com"
            spellCheck={false}
            autoCapitalize="none"
            autoCorrect="off"
            className="w-full h-10 pl-9 pr-3 rounded-lg border border-input bg-background text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring transition"
          />
        </div>

        {/* Record type selector */}
        <div ref={selectRef} className="relative w-full sm:w-32">
          <button
            type="button"
            onClick={() => setSelectOpen((o) => !o)}
            className="w-full h-10 px-3 rounded-lg border border-input bg-background text-sm flex items-center justify-between gap-1 focus:outline-none focus:ring-2 focus:ring-ring transition hover:bg-accent/40"
          >
            <span className="font-mono font-medium">{recordType}</span>
            <ChevronDown className={`h-4 w-4 text-muted-foreground shrink-0 transition-transform ${selectOpen ? "rotate-180" : ""}`} />
          </button>
          {selectOpen && (
            <div className="absolute z-50 mt-1 w-full rounded-lg border border-border bg-popover shadow-md overflow-hidden">
              {RECORD_TYPES.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => { setRecordType(t); setSelectOpen(false); }}
                  className={`w-full text-left px-3 py-2 text-sm font-mono hover:bg-accent/50 transition-colors ${t === recordType ? "bg-accent/70 font-semibold" : ""}`}
                >
                  {t}
                </button>
              ))}
            </div>
          )}
        </div>

        <button
          type="submit"
          disabled={loading || !domain.trim()}
          className="h-10 px-5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2 shrink-0"
        >
          {loading ? (
            <><Loader2 className="h-4 w-4 animate-spin" /> Looking up…</>
          ) : (
            "Lookup"
          )}
        </button>
      </form>

      {/* Turnstile verification */}
      {SITE_KEY && (
        <div className="flex justify-end">
          <Turnstile
            siteKey={SITE_KEY}
            size="flexible"
            onToken={setToken}
            onExpired={() => setToken(null)}
          />
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* Results */}
      {result && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              {result.type} records for{" "}
              <span className="text-foreground font-mono">{result.domain}</span>
            </h3>
            <span className="text-xs text-muted-foreground">
              {result.records?.length ?? 0} record{(result.records?.length ?? 0) !== 1 ? "s" : ""}
            </span>
          </div>
          <ResultsTable data={result} />
        </div>
      )}

      {/* Empty state */}
      {!result && !error && !loading && (
        <div className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">
          Enter a domain name and select a record type to begin.
        </div>
      )}
    </div>
  );
}
