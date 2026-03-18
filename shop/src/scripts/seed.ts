import type { ExecArgs } from "@medusajs/framework/types";
import { Modules } from "@medusajs/framework/utils";

export default async function seed({ container }: ExecArgs) {
  const productService = container.resolve(Modules.PRODUCT);
  const salesChannelService = container.resolve(Modules.SALES_CHANNEL);
  const regionService = container.resolve(Modules.REGION);

  // Create default sales channel
  const salesChannel = await salesChannelService.createSalesChannels({
    name: "1tt.dev Shop",
    description: "Online store for 1tt.dev merch",
  });
  console.log("Created sales channel:", salesChannel.id);

  // Create regions
  const usRegion = await regionService.createRegions({
    name: "US",
    currency_code: "usd",
    countries: ["us"],
  });
  const euRegion = await regionService.createRegions({
    name: "Europe",
    currency_code: "eur",
    countries: ["de", "fr", "nl", "gb", "it", "es"],
  });
  console.log("Created regions:", usRegion.id, euRegion.id);

  // Create sample products
  const products = await productService.createProducts([
    {
      title: "1tt.dev Logo Tee",
      description:
        "Premium cotton t-shirt with the 1tt.dev gradient logo. Comfortable fit for long coding sessions.",
      handle: "1tt-logo-tee",
      status: "published",
      options: [
        { title: "Size", values: ["S", "M", "L", "XL", "2XL"] },
        { title: "Color", values: ["Black", "White", "Navy"] },
      ],
      variants: [
        { title: "S / Black", sku: "TEE-BLK-S", options: { Size: "S", Color: "Black" }, prices: [{ amount: 2999, currency_code: "usd" }, { amount: 2799, currency_code: "eur" }] },
        { title: "M / Black", sku: "TEE-BLK-M", options: { Size: "M", Color: "Black" }, prices: [{ amount: 2999, currency_code: "usd" }, { amount: 2799, currency_code: "eur" }] },
        { title: "L / Black", sku: "TEE-BLK-L", options: { Size: "L", Color: "Black" }, prices: [{ amount: 2999, currency_code: "usd" }, { amount: 2799, currency_code: "eur" }] },
        { title: "M / White", sku: "TEE-WHT-M", options: { Size: "M", Color: "White" }, prices: [{ amount: 2999, currency_code: "usd" }, { amount: 2799, currency_code: "eur" }] },
        { title: "L / White", sku: "TEE-WHT-L", options: { Size: "L", Color: "White" }, prices: [{ amount: 2999, currency_code: "usd" }, { amount: 2799, currency_code: "eur" }] },
      ],
    },
    {
      title: "1tt.dev Sticker Pack",
      description:
        "Set of 5 high-quality vinyl stickers. Weather-resistant, perfect for laptops and water bottles.",
      handle: "1tt-sticker-pack",
      status: "published",
      variants: [
        { title: "Default", sku: "STICKER-5PK", prices: [{ amount: 799, currency_code: "usd" }, { amount: 699, currency_code: "eur" }] },
      ],
    },
    {
      title: "1tt.dev Hoodie",
      description:
        "Heavyweight hoodie with embroidered 1tt.dev logo. Kangaroo pocket, ribbed cuffs.",
      handle: "1tt-hoodie",
      status: "published",
      options: [{ title: "Size", values: ["S", "M", "L", "XL", "2XL"] }],
      variants: [
        { title: "S", sku: "HOOD-BLK-S", options: { Size: "S" }, prices: [{ amount: 5999, currency_code: "usd" }, { amount: 5499, currency_code: "eur" }] },
        { title: "M", sku: "HOOD-BLK-M", options: { Size: "M" }, prices: [{ amount: 5999, currency_code: "usd" }, { amount: 5499, currency_code: "eur" }] },
        { title: "L", sku: "HOOD-BLK-L", options: { Size: "L" }, prices: [{ amount: 5999, currency_code: "usd" }, { amount: 5499, currency_code: "eur" }] },
        { title: "XL", sku: "HOOD-BLK-XL", options: { Size: "XL" }, prices: [{ amount: 5999, currency_code: "usd" }, { amount: 5499, currency_code: "eur" }] },
      ],
    },
    {
      title: "1tt.dev Mug",
      description: "Ceramic mug with the 1tt.dev logo. 11oz, dishwasher safe.",
      handle: "1tt-mug",
      status: "published",
      variants: [
        { title: "Default", sku: "MUG-11OZ", prices: [{ amount: 1499, currency_code: "usd" }, { amount: 1399, currency_code: "eur" }] },
      ],
    },
  ]);

  console.log(`Seeded ${products.length} products`);
  console.log("Done!");
}
