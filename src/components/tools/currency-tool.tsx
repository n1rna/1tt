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
  TrendingUp,
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

type Tab = "rates" | "convert";

export function CurrencyTool() {
  const [tab, setTab] = useState<Tab>("rates");
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

  // Load currencies on mount
  useEffect(() => {
    fetchCurrencies()
      .then(setCurrencies)
      .catch(() => setError("Failed to load currencies"));
  }, []);

  // Fetch rates when base changes
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
      setConvertedResult({ rate: 1, result: amount, date: new Date().toISOString().split("T")[0] });
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

  // Auto-convert on changes
  useEffect(() => {
    if (tab === "convert" && fromAmount && parseFloat(fromAmount) > 0) {
      handleConvert();
    }
  }, [fromCurrency, toCurrency, tab]); // eslint-disable-line react-hooks/exhaustive-deps

  const swapCurrencies = useCallback(() => {
    setFromCurrency(toCurrency);
    setToCurrency(fromCurrency);
  }, [fromCurrency, toCurrency]);

  // Sorted rates: popular first, then rest alphabetically
  const sortedRates = useMemo(() => {
    if (!rates) return [];
    const entries = Object.entries(rates.rates);
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
      const aPopular = POPULAR_CURRENCIES.indexOf(a);
      const bPopular = POPULAR_CURRENCIES.indexOf(b);
      if (aPopular !== -1 && bPopular !== -1) return aPopular - bPopular;
      if (aPopular !== -1) return -1;
      if (bPopular !== -1) return 1;
      return a.localeCompare(b);
    });
  }, [rates, currencies, rateFilter]);

  const currencyName = (code: string) =>
    currencies.find((c) => c.code === code)?.name || code;

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)] max-h-[calc(100vh-3.5rem)] overflow-hidden">
      {/* Toolbar */}
      <div className="border-b shrink-0">
        <div className="max-w-6xl mx-auto flex items-center gap-2 px-6 py-2">
          <DollarSign className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-semibold">Currency Tool</span>

          {rates && (
            <span className="text-xs text-muted-foreground ml-2">
              ECB rates · {rates.date}
            </span>
          )}

          <div className="flex items-center gap-1 ml-auto">
            <Button
              variant={tab === "rates" ? "secondary" : "ghost"}
              size="sm"
              className="h-7 px-2.5 text-xs"
              onClick={() => setTab("rates")}
            >
              <TrendingUp className="h-3.5 w-3.5 mr-1" />
              Rates
            </Button>
            <Button
              variant={tab === "convert" ? "secondary" : "ghost"}
              size="sm"
              className="h-7 px-2.5 text-xs"
              onClick={() => setTab("convert")}
            >
              <ArrowRightLeft className="h-3.5 w-3.5 mr-1" />
              Convert
            </Button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0 overflow-auto">
        {error && (
          <div className="max-w-2xl mx-auto mt-4 px-6">
            <div className="flex items-center gap-2 text-sm text-red-500 bg-red-500/10 rounded-lg p-3">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {error}
            </div>
          </div>
        )}

        {tab === "rates" && (
          <div className="max-w-2xl mx-auto p-6 space-y-4">
            {/* Base currency selector + filter */}
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Base</span>
                <Select
                  value={baseCurrency}
                  onValueChange={(v) => v && setBaseCurrency(v)}
                >
                  <SelectTrigger size="sm" className="text-xs w-28">
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

              <div className="relative flex-1 max-w-xs">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/50" />
                <input
                  type="text"
                  placeholder="Filter currencies..."
                  value={rateFilter}
                  onChange={(e) => setRateFilter(e.target.value)}
                  className="w-full h-8 pl-8 pr-3 text-xs rounded-md border bg-transparent focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </div>

              <Button
                variant="ghost"
                size="sm"
                className="h-8 px-2"
                onClick={() => loadRates(baseCurrency)}
                disabled={loading}
              >
                <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
              </Button>
            </div>

            {/* Rates table */}
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
                    {sortedRates.map(([code, rate]) => (
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
                          {getCurrencySymbol(code)}{formatRate(rate)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <p className="text-[10px] text-muted-foreground/50 text-center">
              Rates from the European Central Bank via Frankfurter API. Updated
              on business days around 16:00 CET.
            </p>
          </div>
        )}

        {tab === "convert" && (
          <div className="max-w-md mx-auto p-6 space-y-6">
            {/* From */}
            <div className="space-y-2">
              <label className="text-xs text-muted-foreground">From</label>
              <div className="flex gap-2">
                <Select
                  value={fromCurrency}
                  onValueChange={(v) => v && setFromCurrency(v)}
                >
                  <SelectTrigger size="sm" className="text-xs w-32 shrink-0">
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
                <input
                  type="number"
                  value={fromAmount}
                  onChange={(e) => setFromAmount(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleConvert();
                  }}
                  placeholder="Amount"
                  className="flex-1 h-8 px-3 text-sm rounded-md border bg-transparent focus:outline-none focus:ring-1 focus:ring-ring font-mono"
                  min="0"
                  step="any"
                />
              </div>
            </div>

            {/* Swap button */}
            <div className="flex justify-center">
              <Button
                variant="outline"
                size="sm"
                className="h-8 w-8 p-0 rounded-full"
                onClick={swapCurrencies}
              >
                <ArrowRightLeft className="h-3.5 w-3.5 rotate-90" />
              </Button>
            </div>

            {/* To */}
            <div className="space-y-2">
              <label className="text-xs text-muted-foreground">To</label>
              <div className="flex gap-2">
                <Select
                  value={toCurrency}
                  onValueChange={(v) => v && setToCurrency(v)}
                >
                  <SelectTrigger size="sm" className="text-xs w-32 shrink-0">
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
                <div className="flex-1 h-8 px-3 text-sm rounded-md border bg-muted/30 flex items-center font-mono">
                  {converting ? (
                    <RefreshCw className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                  ) : convertedResult ? (
                    <span>{formatAmount(convertedResult.result)}</span>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </div>
              </div>
            </div>

            {/* Convert button */}
            <Button
              className="w-full"
              onClick={handleConvert}
              disabled={converting || !fromAmount || parseFloat(fromAmount) <= 0}
            >
              {converting ? (
                <RefreshCw className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <ArrowRightLeft className="h-4 w-4 mr-2" />
              )}
              Convert
            </Button>

            {/* Result details */}
            {convertedResult && !converting && (
              <div className="border rounded-lg p-4 bg-muted/20 space-y-2">
                <div className="text-center">
                  <div className="text-2xl font-bold font-mono">
                    {getCurrencySymbol(toCurrency)}
                    {formatAmount(convertedResult.result)}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {fromAmount} {fromCurrency} = {formatAmount(convertedResult.result)}{" "}
                    {toCurrency}
                  </div>
                </div>
                <div className="flex justify-between text-xs text-muted-foreground pt-2 border-t">
                  <span>
                    1 {fromCurrency} = {formatRate(convertedResult.rate)}{" "}
                    {toCurrency}
                  </span>
                  <span>{convertedResult.date}</span>
                </div>
              </div>
            )}

            <p className="text-[10px] text-muted-foreground/50 text-center">
              Rates from the European Central Bank via Frankfurter API. Updated
              on business days around 16:00 CET.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
