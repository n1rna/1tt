import { CurrencyTool } from "@/components/tools/currency-tool";
import { toolMetadata, toolJsonLd } from "@/lib/tools/seo";

export const metadata = toolMetadata({
  slug: "currency",
  title: "Currency Converter & Exchange Rates",
  description:
    "View live exchange rates for 30+ world currencies and convert between them. Powered by European Central Bank data. Supports USD, EUR, GBP, JPY, CHF, and more.",
  keywords: [
    "currency converter",
    "exchange rate",
    "currency exchange",
    "forex rates",
    "usd to eur",
    "eur to usd",
    "convert currency",
    "live exchange rates",
    "currency calculator",
    "ecb rates",
  ],
});

export default function CurrencyPage() {
  const jsonLd = toolJsonLd("currency");
  return (
    <>
      {jsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      )}
      <style>{`body { overflow: hidden; }`}</style>
      <CurrencyTool />
    </>
  );
}
