"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import {
  TrendingUp,
  RefreshCw,
  ArrowRightLeft,
  AlertCircle,
  Search,
} from "lucide-react";
import {
  fetchCurrencies,
  fetchRates,
  formatRate,
  getCurrencySymbol,
  POPULAR_CURRENCIES,
  type CurrencyInfo,
  type ExchangeRates,
} from "@/lib/tools/currency";
import {
  fetchMarketData,
  formatPrice,
  formatChange,
  formatMarketCap,
  getAssetLabel,
  HIGHLIGHT_IDS,
  MARKET_IDS,
  type MarketAsset,
} from "@/lib/tools/finance";

function toPlainNumber(n: number): string {
  return parseFloat(n.toFixed(6)).toString();
}

/** Tiny sparkline rendered as SVG polyline */
function Sparkline({
  data,
  positive,
}: {
  data: number[];
  positive: boolean;
}) {
  if (data.length < 2) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const w = 80;
  const h = 28;
  const points = data
    .map((v, i) => {
      const x = (i / (data.length - 1)) * w;
      const y = h - ((v - min) / range) * h;
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="shrink-0">
      <polyline
        points={points}
        fill="none"
        stroke={positive ? "#22c55e" : "#ef4444"}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Crypto entries for the converter dropdown */
const CRYPTO_CONVERTER_IDS = ["bitcoin", "ethereum", "pax-gold", "solana", "ripple", "dogecoin", "litecoin", "cardano"];
const CRYPTO_SYMBOLS: Record<string, { symbol: string; name: string }> = {
  bitcoin: { symbol: "BTC", name: "Bitcoin" },
  ethereum: { symbol: "ETH", name: "Ethereum" },
  "pax-gold": { symbol: "PAXG", name: "Gold (PAXG)" },
  solana: { symbol: "SOL", name: "Solana" },
  ripple: { symbol: "XRP", name: "Ripple" },
  dogecoin: { symbol: "DOGE", name: "Dogecoin" },
  litecoin: { symbol: "LTC", name: "Litecoin" },
  cardano: { symbol: "ADA", name: "Cardano" },
};

function isCrypto(code: string): boolean {
  return code.startsWith("CRYPTO:");
}

function cryptoId(code: string): string {
  return code.replace("CRYPTO:", "");
}

const HIGHLIGHT_FIAT = ["EUR", "GBP", "JPY"];

type MarketTab = "crypto" | "fiat";

export function CurrencyTool() {
  // Market data
  const [assets, setAssets] = useState<MarketAsset[]>([]);
  const [marketLoading, setMarketLoading] = useState(true);
  const [marketError, setMarketError] = useState<string | null>(null);

  // Currency data
  const [currencies, setCurrencies] = useState<CurrencyInfo[]>([]);
  const [rates, setRates] = useState<ExchangeRates | null>(null);
  const [ratesLoading, setRatesLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Converter
  const [leftCode, setLeftCode] = useState("CRYPTO:bitcoin");
  const [rightCode, setRightCode] = useState("USD");
  const [leftAmount, setLeftAmount] = useState("1");
  const [rightAmount, setRightAmount] = useState("");
  const [convLoading, setConvLoading] = useState(false);

  // Market tab
  const [activeTab, setActiveTab] = useState<MarketTab>("crypto");
  const [rateFilter, setRateFilter] = useState("");

  // USD-based fiat rates for unified conversion
  const [usdRates, setUsdRates] = useState<ExchangeRates | null>(null);

  // Load market data
  const loadMarket = useCallback(async () => {
    setMarketLoading(true);
    setMarketError(null);
    try {
      const data = await fetchMarketData(MARKET_IDS);
      setAssets(data);
    } catch {
      setMarketError("Failed to load market data");
    }
    setMarketLoading(false);
  }, []);

  useEffect(() => {
    loadMarket();
  }, [loadMarket]);

  // Load currencies + USD rates (always fetch USD base for conversions)
  useEffect(() => {
    fetchCurrencies()
      .then(setCurrencies)
      .catch(() => setError("Failed to load currencies"));
    fetchRates("USD")
      .then((r) => {
        setUsdRates(r);
        setRates(r);
        setRatesLoading(false);
      })
      .catch(() => {
        setError("Failed to fetch exchange rates");
        setRatesLoading(false);
      });
  }, []);

  const reloadRates = useCallback(() => {
    setRatesLoading(true);
    fetchRates("USD")
      .then((r) => {
        setUsdRates(r);
        setRates(r);
      })
      .catch(() => setError("Failed to fetch exchange rates"))
      .finally(() => setRatesLoading(false));
  }, []);

  // Build crypto price map from assets
  const cryptoPriceMap = useMemo(() => {
    const map: Record<string, number> = {};
    for (const a of assets) {
      map[a.id] = a.current_price; // USD price
    }
    return map;
  }, [assets]);

  // Converter options: crypto + fiat combined
  const converterOptions = useMemo(() => {
    const opts: { value: string; label: string; group: "crypto" | "fiat" }[] = [];
    for (const id of CRYPTO_CONVERTER_IDS) {
      const info = CRYPTO_SYMBOLS[id];
      if (info) {
        opts.push({ value: `CRYPTO:${id}`, label: `${info.symbol} — ${info.name}`, group: "crypto" });
      }
    }
    // Popular fiat first, then rest
    const added = new Set<string>();
    for (const code of POPULAR_CURRENCIES) {
      const c = currencies.find((c) => c.code === code);
      if (c) {
        opts.push({ value: c.code, label: `${c.code} — ${c.name}`, group: "fiat" });
        added.add(c.code);
      }
    }
    for (const c of currencies) {
      if (!added.has(c.code)) {
        opts.push({ value: c.code, label: `${c.code} — ${c.name}`, group: "fiat" });
      }
    }
    return opts;
  }, [currencies]);

  // Compute conversion rate between any two codes (crypto or fiat)
  const computeRate = useCallback(
    (from: string, to: string): number | null => {
      if (from === to) return 1;

      // Get USD price for each side
      const toUsd = (code: string): number | null => {
        if (isCrypto(code)) {
          return cryptoPriceMap[cryptoId(code)] ?? null;
        }
        if (code === "USD") return 1;
        // fiat: use inverse of usdRates
        if (usdRates?.rates[code] != null) {
          return 1 / usdRates.rates[code];
        }
        return null;
      };

      const fromUsd = toUsd(from);
      const toUsdRate = toUsd(to);
      if (fromUsd == null || toUsdRate == null) return null;

      // from -> USD -> to
      // 1 unit of `from` = fromUsd USD, 1 unit of `to` = toUsdRate USD
      // so 1 from = fromUsd / toUsdRate to
      return fromUsd / toUsdRate;
    },
    [cryptoPriceMap, usdRates]
  );

  // Update converter when rate inputs change
  const convRate = useMemo(() => computeRate(leftCode, rightCode), [leftCode, rightCode, computeRate]);

  useEffect(() => {
    if (convRate == null) return;
    const v = parseFloat(leftAmount);
    if (!isNaN(v)) setRightAmount(toPlainNumber(v * convRate));
  }, [convRate]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleLeftChange = useCallback(
    (val: string) => {
      setLeftAmount(val);
      const v = parseFloat(val);
      if (convRate != null && !isNaN(v)) {
        setRightAmount(toPlainNumber(v * convRate));
      } else {
        setRightAmount("");
      }
    },
    [convRate]
  );

  const handleRightChange = useCallback(
    (val: string) => {
      setRightAmount(val);
      const v = parseFloat(val);
      if (convRate != null && convRate !== 0 && !isNaN(v)) {
        setLeftAmount(toPlainNumber(v / convRate));
      } else {
        setLeftAmount("");
      }
    },
    [convRate]
  );

  const swapCurrencies = useCallback(() => {
    setLeftCode(rightCode);
    setRightCode(leftCode);
    setLeftAmount(rightAmount);
    setRightAmount(leftAmount);
  }, [leftCode, rightCode, leftAmount, rightAmount]);

  const displayCode = (code: string) => {
    if (isCrypto(code)) {
      const info = CRYPTO_SYMBOLS[cryptoId(code)];
      return info?.symbol || cryptoId(code);
    }
    return code;
  };

  // Highlight assets (BTC, ETH, Gold)
  const highlightAssets = useMemo(
    () => HIGHLIGHT_IDS.map((id) => assets.find((a) => a.id === id)).filter(Boolean) as MarketAsset[],
    [assets]
  );

  // Highlight fiat rates (from USD base)
  const highlightFiatRates = useMemo(() => {
    if (!usdRates) return [];
    return HIGHLIGHT_FIAT.filter((c) => usdRates.rates[c] != null).map((code) => ({
      code,
      rate: usdRates.rates[code],
      name: currencies.find((c) => c.code === code)?.name || code,
    }));
  }, [usdRates, currencies]);

  // Crypto table (all assets)
  const cryptoTableAssets = useMemo(() => assets, [assets]);

  // Fiat table
  const fiatTableRates = useMemo(() => {
    if (!usdRates) return [];
    const entries = Object.entries(usdRates.rates);
    const q = rateFilter.toLowerCase();
    const filtered = q
      ? entries.filter(([code]) => {
          const info = currencies.find((c) => c.code === code);
          return code.toLowerCase().includes(q) || (info && info.name.toLowerCase().includes(q));
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
  }, [usdRates, currencies, rateFilter]);

  const allLoading = marketLoading && ratesLoading;

  const convRateDisplay = useMemo(() => {
    if (convRate == null) return null;
    if (convRate >= 1000) return convRate.toLocaleString("en-US", { maximumFractionDigits: 2 });
    if (convRate >= 1) return convRate.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 4 });
    if (convRate >= 0.0001) return convRate.toLocaleString("en-US", { minimumFractionDigits: 4, maximumFractionDigits: 6 });
    return convRate.toExponential(4);
  }, [convRate]);

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Toolbar */}
      <div className="border-b shrink-0">
        <div className="max-w-6xl mx-auto flex items-center gap-2 px-6 py-2">
          <TrendingUp className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-semibold">Finance</span>
          {usdRates && (
            <span className="text-xs text-muted-foreground ml-2">
              ECB · {usdRates.date}
            </span>
          )}
          <div className="flex items-center gap-2 ml-auto">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={() => {
                loadMarket();
                reloadRates();
              }}
              disabled={allLoading}
            >
              <RefreshCw className={`h-3.5 w-3.5 mr-1 ${allLoading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0 overflow-auto">
        <div className="max-w-5xl mx-auto p-6 space-y-6">
          {(marketError || error) && (
            <div className="flex items-center gap-2 text-sm text-red-500 bg-red-500/10 rounded-lg p-3">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {marketError || error}
            </div>
          )}

          {/* Converter */}
          <section>
            <div className="border rounded-lg p-4 bg-muted/10 space-y-3">
              <div className="flex items-center gap-3">
                {/* Left side */}
                <div className="flex-1 space-y-1.5">
                  <Select value={leftCode} onValueChange={(v) => v && setLeftCode(v)}>
                    <SelectTrigger size="sm" className="text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="max-h-60">
                      <SelectItem value="__crypto_label" disabled className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
                        Crypto
                      </SelectItem>
                      {converterOptions.filter((o) => o.group === "crypto").map((o) => (
                        <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                      ))}
                      <SelectItem value="__fiat_label" disabled className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mt-1">
                        Fiat
                      </SelectItem>
                      {converterOptions.filter((o) => o.group === "fiat").map((o) => (
                        <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <input
                    type="number"
                    value={leftAmount}
                    onChange={(e) => handleLeftChange(e.target.value)}
                    placeholder="0.00"
                    className="w-full h-10 px-3 text-lg rounded-md border bg-transparent focus:outline-none focus:ring-1 focus:ring-ring font-mono"
                    min="0"
                    step="any"
                  />
                </div>

                <button
                  onClick={swapCurrencies}
                  className="p-2 rounded-full border hover:bg-muted text-muted-foreground hover:text-foreground transition-colors shrink-0 mt-5"
                >
                  <ArrowRightLeft className="h-4 w-4" />
                </button>

                {/* Right side */}
                <div className="flex-1 space-y-1.5">
                  <Select value={rightCode} onValueChange={(v) => v && setRightCode(v)}>
                    <SelectTrigger size="sm" className="text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="max-h-60">
                      <SelectItem value="__crypto_label2" disabled className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
                        Crypto
                      </SelectItem>
                      {converterOptions.filter((o) => o.group === "crypto").map((o) => (
                        <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                      ))}
                      <SelectItem value="__fiat_label2" disabled className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mt-1">
                        Fiat
                      </SelectItem>
                      {converterOptions.filter((o) => o.group === "fiat").map((o) => (
                        <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <input
                    type="number"
                    value={rightAmount}
                    onChange={(e) => handleRightChange(e.target.value)}
                    placeholder="0.00"
                    className="w-full h-10 px-3 text-lg rounded-md border bg-transparent focus:outline-none focus:ring-1 focus:ring-ring font-mono"
                    min="0"
                    step="any"
                  />
                </div>
              </div>
              {convRateDisplay != null && (
                <div className="text-[11px] text-muted-foreground/60">
                  1 {displayCode(leftCode)} = {convRateDisplay} {displayCode(rightCode)}
                  {usdRates?.date && <> · {usdRates.date}</>}
                </div>
              )}
            </div>
          </section>

          {/* Highlight cards: crypto + fiat in one row */}
          <section>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
              {/* Crypto highlights */}
              {marketLoading && assets.length === 0
                ? [1, 2, 3].map((i) => (
                    <div key={`cs${i}`} className="border rounded-lg p-3 bg-muted/20 h-20 animate-pulse" />
                  ))
                : highlightAssets.map((asset) => {
                    const change = formatChange(asset.price_change_percentage_24h);
                    return (
                      <div key={asset.id} className="border rounded-lg p-3 bg-muted/20">
                        <div className="flex items-center gap-1.5 mb-1">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={asset.image} alt="" className="h-4 w-4 rounded-full" />
                          <span className="text-[11px] text-muted-foreground font-medium truncate">
                            {getAssetLabel(asset)}
                          </span>
                        </div>
                        <div className="text-base font-bold font-mono">
                          ${formatPrice(asset.current_price)}
                        </div>
                        <span className={`text-[11px] font-medium ${change.positive ? "text-green-500" : "text-red-500"}`}>
                          {change.text}
                        </span>
                      </div>
                    );
                  })}

              {/* Fiat highlights */}
              {ratesLoading && !usdRates
                ? [1, 2, 3].map((i) => (
                    <div key={`fs${i}`} className="border rounded-lg p-3 bg-muted/20 h-20 animate-pulse" />
                  ))
                : highlightFiatRates.map(({ code, rate, name }) => (
                    <div key={code} className="border rounded-lg p-3 bg-muted/20">
                      <div className="flex items-center gap-1.5 mb-1">
                        <span className="text-[11px] text-muted-foreground font-medium truncate">
                          USD/{code}
                        </span>
                      </div>
                      <div className="text-base font-bold font-mono">
                        {formatRate(rate)}
                      </div>
                      <span className="text-[11px] text-muted-foreground/60">{name}</span>
                    </div>
                  ))}
            </div>
          </section>

          {/* Market tabs */}
          <section>
            <div className="flex items-center gap-1 border-b mb-4">
              {(["crypto", "fiat"] as MarketTab[]).map((tab) => (
                <button
                  key={tab}
                  onClick={() => { setActiveTab(tab); setRateFilter(""); }}
                  className={`px-3 py-2 text-xs font-medium border-b-2 transition-colors -mb-px ${
                    activeTab === tab
                      ? "border-foreground text-foreground"
                      : "border-transparent text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {tab === "crypto" ? "Crypto" : "Currencies"}
                </button>
              ))}
            </div>

            {/* Crypto tab */}
            {activeTab === "crypto" && (
              <>
                {marketLoading && assets.length === 0 ? (
                  <div className="text-sm text-muted-foreground text-center py-12">Loading market data...</div>
                ) : (
                  <div className="border rounded-lg overflow-hidden">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b bg-muted/30">
                          <th className="text-left px-4 py-2 text-xs font-medium text-muted-foreground">Asset</th>
                          <th className="text-right px-3 py-2 text-xs font-medium text-muted-foreground">Price</th>
                          <th className="text-right px-3 py-2 text-xs font-medium text-muted-foreground">24h</th>
                          <th className="text-right px-3 py-2 text-xs font-medium text-muted-foreground hidden sm:table-cell">7d</th>
                          <th className="text-right px-3 py-2 text-xs font-medium text-muted-foreground hidden md:table-cell">30d</th>
                          <th className="text-right px-3 py-2 text-xs font-medium text-muted-foreground hidden sm:table-cell">7d chart</th>
                          <th className="text-right px-4 py-2 text-xs font-medium text-muted-foreground hidden md:table-cell">Market Cap</th>
                        </tr>
                      </thead>
                      <tbody>
                        {cryptoTableAssets.map((asset) => {
                          const c24 = formatChange(asset.price_change_percentage_24h);
                          const c7d = formatChange(asset.price_change_percentage_7d_in_currency);
                          const c30d = formatChange(asset.price_change_percentage_30d_in_currency);
                          const sparkData = asset.sparkline_in_7d?.price || [];
                          const sparkPositive = (asset.price_change_percentage_7d_in_currency ?? 0) >= 0;
                          return (
                            <tr key={asset.id} className="border-b last:border-0 hover:bg-muted/20 transition-colors">
                              <td className="px-4 py-2.5">
                                <div className="flex items-center gap-2">
                                  {/* eslint-disable-next-line @next/next/no-img-element */}
                                  <img src={asset.image} alt="" className="h-5 w-5 rounded-full shrink-0" />
                                  <span className="font-medium text-sm">{getAssetLabel(asset)}</span>
                                  <span className="text-xs text-muted-foreground uppercase">{asset.symbol}</span>
                                </div>
                              </td>
                              <td className="px-3 py-2.5 text-right font-mono text-sm">${formatPrice(asset.current_price)}</td>
                              <td className={`px-3 py-2.5 text-right text-xs font-medium ${c24.positive ? "text-green-500" : "text-red-500"}`}>{c24.text}</td>
                              <td className={`px-3 py-2.5 text-right text-xs font-medium hidden sm:table-cell ${c7d.positive ? "text-green-500" : "text-red-500"}`}>{c7d.text}</td>
                              <td className={`px-3 py-2.5 text-right text-xs font-medium hidden md:table-cell ${c30d.positive ? "text-green-500" : "text-red-500"}`}>{c30d.text}</td>
                              <td className="px-3 py-2.5 text-right hidden sm:table-cell">
                                <div className="flex justify-end">
                                  <Sparkline data={sparkData} positive={sparkPositive} />
                                </div>
                              </td>
                              <td className="px-4 py-2.5 text-right text-xs text-muted-foreground hidden md:table-cell">{formatMarketCap(asset.market_cap)}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}

            {/* Fiat currencies tab */}
            {activeTab === "fiat" && (
              <>
                <div className="relative max-w-xs mb-3">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/50" />
                  <input
                    type="text"
                    placeholder="Filter currencies..."
                    value={rateFilter}
                    onChange={(e) => setRateFilter(e.target.value)}
                    className="w-full h-8 pl-8 pr-3 text-xs rounded-md border bg-transparent focus:outline-none focus:ring-1 focus:ring-ring"
                  />
                </div>
                {ratesLoading && !usdRates ? (
                  <div className="text-sm text-muted-foreground text-center py-12">Loading rates...</div>
                ) : (
                  <div className="border rounded-lg overflow-hidden">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b bg-muted/30">
                          <th className="text-left px-4 py-2 text-xs font-medium text-muted-foreground">Currency</th>
                          <th className="text-right px-4 py-2 text-xs font-medium text-muted-foreground">Rate</th>
                          <th className="text-right px-4 py-2 text-xs font-medium text-muted-foreground">1 USD =</th>
                        </tr>
                      </thead>
                      <tbody>
                        {fiatTableRates.map(([code, rate]) => (
                          <tr key={code} className="border-b last:border-0 hover:bg-muted/20 transition-colors">
                            <td className="px-4 py-2.5">
                              <div className="flex items-center gap-2">
                                <span className="font-mono font-medium text-sm">{code}</span>
                                <span className="text-xs text-muted-foreground truncate">
                                  {currencies.find((c) => c.code === code)?.name || code}
                                </span>
                              </div>
                            </td>
                            <td className="px-4 py-2.5 text-right font-mono text-sm">{formatRate(rate)}</td>
                            <td className="px-4 py-2.5 text-right text-sm text-muted-foreground">
                              {getCurrencySymbol(code)}{formatRate(rate)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}
          </section>

          <p className="text-[10px] text-muted-foreground/50 text-center pb-2">
            Market data from CoinGecko. Currency rates from the European Central Bank via Frankfurter API.
          </p>
        </div>
      </div>
    </div>
  );
}
