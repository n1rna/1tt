import { CurrencyTool } from "@/components/tools/currency-tool";
import { toolMetadata, toolJsonLd } from "@/lib/tools/seo";

export const metadata = toolMetadata({
  slug: "currency",
  title: "Finance Tool — Crypto, Gold & Currency Converter",
  description:
    "Live crypto prices (Bitcoin, Ethereum), gold tracking via PAXG, exchange rates for 30+ currencies, and a two-sided currency converter. Market data with sparkline charts powered by CoinGecko and ECB.",
  keywords: [
    "finance tool",
    "crypto prices",
    "bitcoin price",
    "ethereum price",
    "gold price",
    "currency converter",
    "exchange rate",
    "forex rates",
    "market data",
    "sparkline chart",
    "coingecko",
    "ecb rates",
  ],
});

export default function CurrencyPage() {
  const jsonLd = toolJsonLd("currency");
  return (
    <>
      {jsonLd?.map((item, i) => (
        <script
          key={i}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(item) }}
        />
      ))}
      <style>{`body { overflow: hidden; }`}</style>
      <CurrencyTool />
    </>
  );
}
