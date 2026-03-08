const API_BASE = "https://api.frankfurter.dev/v1";

export interface CurrencyInfo {
  code: string;
  name: string;
}

export interface ExchangeRates {
  base: string;
  date: string;
  rates: Record<string, number>;
}

/** Popular currencies shown by default at the top of the list */
export const POPULAR_CURRENCIES = [
  "USD", "EUR", "GBP", "JPY", "CHF", "CAD", "AUD", "CNY",
  "KRW", "INR", "BRL", "MXN", "SGD", "HKD", "TRY", "SEK",
];

const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: "$", EUR: "€", GBP: "£", JPY: "¥", CHF: "Fr",
  CAD: "C$", AUD: "A$", CNY: "¥", KRW: "₩", INR: "₹",
  BRL: "R$", MXN: "$", SGD: "S$", HKD: "HK$", TRY: "₺",
  SEK: "kr", NOK: "kr", DKK: "kr", PLN: "zł", CZK: "Kč",
  HUF: "Ft", THB: "฿", IDR: "Rp", MYR: "RM", PHP: "₱",
  ZAR: "R", NZD: "NZ$", ILS: "₪", RON: "lei", BGN: "лв",
  ISK: "kr",
};

export function getCurrencySymbol(code: string): string {
  return CURRENCY_SYMBOLS[code] || code;
}

let currencyCache: CurrencyInfo[] | null = null;

export async function fetchCurrencies(): Promise<CurrencyInfo[]> {
  if (currencyCache) return currencyCache;

  const res = await fetch(`${API_BASE}/currencies`);
  if (!res.ok) throw new Error("Failed to fetch currencies");

  const data: Record<string, string> = await res.json();
  currencyCache = Object.entries(data).map(([code, name]) => ({ code, name }));
  return currencyCache;
}

export async function fetchRates(base: string): Promise<ExchangeRates> {
  const res = await fetch(`${API_BASE}/latest?base=${base}`);
  if (!res.ok) throw new Error("Failed to fetch rates");
  return res.json();
}

export async function convertCurrency(
  amount: number,
  from: string,
  to: string
): Promise<{ rate: number; result: number; date: string }> {
  const res = await fetch(
    `${API_BASE}/latest?amount=${amount}&from=${from}&to=${to}`
  );
  if (!res.ok) throw new Error("Failed to convert");

  const data: ExchangeRates = await res.json();
  const rate = data.rates[to];
  return { rate, result: rate, date: data.date };
}

export function formatRate(rate: number): string {
  if (rate >= 1000) return rate.toLocaleString("en-US", { maximumFractionDigits: 2 });
  if (rate >= 1) return rate.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 4 });
  return rate.toLocaleString("en-US", { minimumFractionDigits: 4, maximumFractionDigits: 6 });
}

export function formatAmount(amount: number): string {
  return amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
