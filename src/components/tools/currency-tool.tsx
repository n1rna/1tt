"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DollarSign,
  RefreshCw,
  ArrowRightLeft,
  AlertCircle,
  Search,
} from "lucide-react";
import {
  fetchCurrencies,
  fetchRates,
  formatRate,
  formatAmount,
  getCurrencySymbol,
  POPULAR_CURRENCIES,
  type CurrencyInfo,
  type ExchangeRates,
} from "@/lib/tools/currency";

const HIGHLIGHT_CURRENCIES = ["EUR", "GBP", "JPY"];

export function CurrencyTool() {
  const [currencies, setCurrencies] = useState<CurrencyInfo[]>([]);
  const [baseCurrency, setBaseCurrency] = useState("USD");
  const [rates, setRates] = useState<ExchangeRates | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rateFilter, setRateFilter] = useState("");

  // Converter state
  const [fromCurrency, setFromCurrency] = useState("USD");
  const [toCurrency, setToCurrency] = useState("EUR");
  const [fromAmount, setFromAmount] = useState("1");
  const [convertedResult, setConvertedResult] = useState<{
    rate: number;
    result: number;
    date: string;
  } | null>(null);
  const [converting, setConverting] = useState(false);

  useEffect(() => {
    fetchCurrencies()
      .then(setCurrencies)
      .catch(() => setError("Failed to load currencies"));
  }, []);

  const loadRates = useCallback(async (base: string) => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchRates(base);
      setRates(data);
    } catch {
      setError("Failed to fetch exchange rates");
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadRates(baseCurrency);
  }, [baseCurrency, loadRates]);

  // Convert
  const handleConvert = useCallback(async () => {
    const amount = parseFloat(fromAmount);
    if (isNaN(amount) || amount <= 0) return;
    if (fromCurrency === toCurrency) {
      setConvertedResult({
        rate: 1,
        result: amount,
        date: new Date().toISOString().split("T")[0],
      });
      return;
    }
    setConverting(true);
    try {
      const res = await fetch(
        `https://api.frankfurter.dev/v1/latest?amount=${amount}&from=${fromCurrency}&to=${toCurrency}`
      );
      if (!res.ok) throw new Error();
      const data = await res.json();
      const result = data.rates[toCurrency];
      const rate = result / amount;
      setConvertedResult({ rate, result, date: data.date });
    } catch {
      setError("Conversion failed");
    }
    setConverting(false);
  }, [fromAmount, fromCurrency, toCurrency]);

  // Auto-convert on currency change
  useEffect(() => {
    if (fromAmount && parseFloat(fromAmount) > 0) {
      handleConvert();
    }
  }, [fromCurrency, toCurrency]); // eslint-disable-line react-hooks/exhaustive-deps

  const swapCurrencies = useCallback(() => {
    setFromCurrency(toCurrency);
    setToCurrency(fromCurrency);
  }, [fromCurrency, toCurrency]);

  const currencyName = (code: string) =>
    currencies.find((c) => c.code === code)?.name || code;

  // Top 3 highlighted rates
  const highlightedRates = useMemo(() => {
    if (!rates) return [];
    return HIGHLIGHT_CURRENCIES.filter((c) => c !== baseCurrency && rates.rates[c] != null).map(
      (code) => ({ code, rate: rates.rates[code] })
    );
  }, [rates, baseCurrency]);

  // Rest of the rates (excluding highlighted), sorted popular-first
  const tableRates = useMemo(() => {
    if (!rates) return [];
    const highlightSet = new Set(HIGHLIGHT_CURRENCIES);
    const entries = Object.entries(rates.rates).filter(
      ([code]) => !highlightSet.has(code)
    );
    const q = rateFilter.toLowerCase();
    const filtered = q
      ? entries.filter(([code]) => {
          const info = currencies.find((c) => c.code === code);
          return (
            code.toLowerCase().includes(q) ||
            (info && info.name.toLowerCase().includes(q))
          );
        })
      : entries;

    return filtered.sort(([a], [b]) => {
      const aIdx = POPULAR_CURRENCIES.indexOf(a);
      const bIdx = POPULAR_CURRENCIES.indexOf(b);
      if (aIdx !== -1 && bIdx !== -1) return aIdx - bIdx;
      if (aIdx !== -1) return -1;
      if (bIdx !== -1) return 1;
      return a.localeCompare(b);
    });
  }, [rates, currencies, rateFilter, baseCurrency]);

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Toolbar */}
      <div className="border-b shrink-0">
        <div className="max-w-6xl mx-auto flex items-center gap-2 px-6 py-2">
          <DollarSign className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-semibold">Currency Tool</span>

          {rates && (
            <span className="text-xs text-muted-foreground ml-2">
              ECB · {rates.date}
            </span>
          )}

          <div className="flex items-center gap-2 ml-auto">
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Base</span>
              <Select
                value={baseCurrency}
                onValueChange={(v) => v && setBaseCurrency(v)}
              >
                <SelectTrigger size="sm" className="text-xs w-24">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="max-h-60">
                  {currencies.map((c) => (
                    <SelectItem key={c.code} value={c.code}>
                      {c.code} — {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2"
              onClick={() => loadRates(baseCurrency)}
              disabled={loading}
            >
              <RefreshCw
                className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`}
              />
            </Button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0 overflow-auto">
        <div className="max-w-2xl mx-auto p-6 space-y-6">
          {error && (
            <div className="flex items-center gap-2 text-sm text-red-500 bg-red-500/10 rounded-lg p-3">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {error}
            </div>
          )}

          {/* Highlighted currencies */}
          {highlightedRates.length > 0 && (
            <div className="grid grid-cols-3 gap-3">
              {highlightedRates.map(({ code, rate }) => (
                <div
                  key={code}
                  className="border rounded-lg p-4 bg-muted/20 text-center"
                >
                  <div className="text-xs text-muted-foreground mb-1">
                    {baseCurrency}/{code}
                  </div>
                  <div className="text-xl font-bold font-mono">
                    {formatRate(rate)}
                  </div>
                  <div className="text-[10px] text-muted-foreground/60 mt-1">
                    {currencyName(code)}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Converter — inline */}
          <div className="border rounded-lg p-4 bg-muted/10 space-y-3">
            <div className="flex items-center gap-2 text-xs text-muted-foreground font-medium">
              <ArrowRightLeft className="h-3.5 w-3.5" />
              Convert
            </div>
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={fromAmount}
                onChange={(e) => setFromAmount(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleConvert();
                }}
                placeholder="1"
                className="w-28 h-8 px-3 text-sm rounded-md border bg-transparent focus:outline-none focus:ring-1 focus:ring-ring font-mono"
                min="0"
                step="any"
              />
              <Select
                value={fromCurrency}
                onValueChange={(v) => v && setFromCurrency(v)}
              >
                <SelectTrigger size="sm" className="text-xs w-24 shrink-0">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="max-h-60">
                  {currencies.map((c) => (
                    <SelectItem key={c.code} value={c.code}>
                      {c.code} — {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <button
                onClick={swapCurrencies}
                className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors shrink-0"
              >
                <ArrowRightLeft className="h-3.5 w-3.5" />
              </button>

              <Select
                value={toCurrency}
                onValueChange={(v) => v && setToCurrency(v)}
              >
                <SelectTrigger size="sm" className="text-xs w-24 shrink-0">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="max-h-60">
                  {currencies.map((c) => (
                    <SelectItem key={c.code} value={c.code}>
                      {c.code} — {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <span className="text-sm font-mono flex-1 text-right">
                {converting ? (
                  <RefreshCw className="h-3.5 w-3.5 animate-spin text-muted-foreground inline" />
                ) : convertedResult ? (
                  <>
                    <span className="text-muted-foreground text-xs mr-1">
                      {getCurrencySymbol(toCurrency)}
                    </span>
                    <span className="font-medium">
                      {formatAmount(convertedResult.result)}
                    </span>
                  </>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </span>

              <Button
                variant="outline"
                size="sm"
                className="h-8 px-3 text-xs shrink-0"
                onClick={handleConvert}
                disabled={
                  converting || !fromAmount || parseFloat(fromAmount) <= 0
                }
              >
                Go
              </Button>
            </div>
            {convertedResult && !converting && (
              <div className="text-[11px] text-muted-foreground/60">
                1 {fromCurrency} = {formatRate(convertedResult.rate)}{" "}
                {toCurrency} · {convertedResult.date}
              </div>
            )}
          </div>

          {/* Filter + Rates table */}
          <div className="space-y-3">
            <div className="relative max-w-xs">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/50" />
              <input
                type="text"
                placeholder="Filter currencies..."
                value={rateFilter}
                onChange={(e) => setRateFilter(e.target.value)}
                className="w-full h-8 pl-8 pr-3 text-xs rounded-md border bg-transparent focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>

            {loading && !rates ? (
              <div className="text-sm text-muted-foreground text-center py-12">
                Loading rates...
              </div>
            ) : (
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/30">
                      <th className="text-left px-4 py-2 text-xs font-medium text-muted-foreground">
                        Currency
                      </th>
                      <th className="text-right px-4 py-2 text-xs font-medium text-muted-foreground">
                        Rate
                      </th>
                      <th className="text-right px-4 py-2 text-xs font-medium text-muted-foreground">
                        1 {baseCurrency} =
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {tableRates.map(([code, rate]) => (
                      <tr
                        key={code}
                        className="border-b last:border-0 hover:bg-muted/20 transition-colors"
                      >
                        <td className="px-4 py-2.5">
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-medium text-sm">
                              {code}
                            </span>
                            <span className="text-xs text-muted-foreground truncate">
                              {currencyName(code)}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono text-sm">
                          {formatRate(rate)}
                        </td>
                        <td className="px-4 py-2.5 text-right text-sm text-muted-foreground">
                          {getCurrencySymbol(code)}
                          {formatRate(rate)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <p className="text-[10px] text-muted-foreground/50 text-center pb-2">
            Rates from the European Central Bank via Frankfurter API. Updated on
            business days around 16:00 CET.
          </p>
        </div>
      </div>
    </div>
  );
}
