import { db, serviceProductsTable } from "@workspace/db";
import type { ServiceProduct } from "@workspace/db";
import { eq } from "drizzle-orm";

const sampleProducts: (typeof serviceProductsTable.$inferInsert)[] = [
  {
    id: "airtime-mtn",
    category: "airtime",
    provider: "MTN",
    name: "MTN airtime",
    description: "Recharge any MTN line",
    priceKobo: null,
    minAmountKobo: 50000,
    maxAmountKobo: 50000000,
  },
  {
    id: "airtime-airtel",
    category: "airtime",
    provider: "Airtel",
    name: "Airtel airtime",
    description: "Recharge any Airtel line",
    priceKobo: null,
    minAmountKobo: 50000,
    maxAmountKobo: 50000000,
  },
  {
    id: "airtime-glo",
    category: "airtime",
    provider: "Glo",
    name: "Glo airtime",
    description: "Recharge any Glo line",
    priceKobo: null,
    minAmountKobo: 50000,
    maxAmountKobo: 50000000,
  },
  {
    id: "airtime-9mobile",
    category: "airtime",
    provider: "9mobile",
    name: "9mobile airtime",
    description: "Recharge any 9mobile line",
    priceKobo: null,
    minAmountKobo: 50000,
    maxAmountKobo: 50000000,
  },
  {
    id: "data-mtn-1gb",
    category: "mobile_data",
    provider: "MTN",
    name: "1 GB · 30 days",
    description: "MTN data plan, valid for 30 days",
    priceKobo: 35000,
    minAmountKobo: null,
    maxAmountKobo: null,
  },
  {
    id: "data-airtel-2gb",
    category: "mobile_data",
    provider: "Airtel",
    name: "2 GB · 30 days",
    description: "Airtel data plan, valid for 30 days",
    priceKobo: 50000,
    minAmountKobo: null,
    maxAmountKobo: null,
  },
  {
    id: "data-glo-3gb",
    category: "mobile_data",
    provider: "Glo",
    name: "3 GB · 30 days",
    description: "Glo data plan, valid for 30 days",
    priceKobo: 70000,
    minAmountKobo: null,
    maxAmountKobo: null,
  },
  {
    id: "data-9mobile-2gb",
    category: "mobile_data",
    provider: "9mobile",
    name: "2 GB · 30 days",
    description: "9mobile data plan, valid for 30 days",
    priceKobo: 50000,
    minAmountKobo: null,
    maxAmountKobo: null,
  },
  {
    id: "power-ikeja",
    category: "electricity",
    provider: "Ikeja Electric",
    name: "Ikeja Electric",
    description: "Pay a prepaid or postpaid electricity bill",
    priceKobo: null,
    minAmountKobo: 100000,
    maxAmountKobo: 100000000,
  },
  {
    id: "power-eko",
    category: "electricity",
    provider: "Eko Electric",
    name: "Eko Electric",
    description: "Pay a prepaid or postpaid electricity bill",
    priceKobo: null,
    minAmountKobo: 100000,
    maxAmountKobo: 100000000,
  },
  {
    id: "power-abuja",
    category: "electricity",
    provider: "Abuja Electricity",
    name: "Abuja Electricity",
    description: "Pay a prepaid or postpaid electricity bill",
    priceKobo: null,
    minAmountKobo: 100000,
    maxAmountKobo: 100000000,
  },
  {
    id: "power-ibadan",
    category: "electricity",
    provider: "IBEDC",
    name: "IBEDC",
    description: "Pay a prepaid or postpaid electricity bill",
    priceKobo: null,
    minAmountKobo: 100000,
    maxAmountKobo: 100000000,
  },
  {
    id: "tv-dstv-compact",
    category: "cable_tv",
    provider: "DStv",
    name: "Compact · 1 month",
    description: "DStv Compact monthly subscription",
    priceKobo: 1500000,
    minAmountKobo: null,
    maxAmountKobo: null,
  },
  {
    id: "tv-gotv-supa",
    category: "cable_tv",
    provider: "GOtv",
    name: "Supa · 1 month",
    description: "GOtv Supa monthly subscription",
    priceKobo: 800000,
    minAmountKobo: null,
    maxAmountKobo: null,
  },
  {
    id: "tv-startimes-smart",
    category: "cable_tv",
    provider: "StarTimes",
    name: "Smart · 1 month",
    description: "StarTimes Smart monthly subscription",
    priceKobo: 700000,
    minAmountKobo: null,
    maxAmountKobo: null,
  },
  {
    id: "subscription-netflix",
    category: "digital_subscription",
    provider: "Netflix",
    name: "Mobile · 1 month",
    description: "Netflix Mobile monthly subscription",
    priceKobo: 600000,
    minAmountKobo: null,
    maxAmountKobo: null,
  },
  {
    id: "subscription-spotify",
    category: "digital_subscription",
    provider: "Spotify",
    name: "Premium Individual · 1 month",
    description: "Spotify Premium Individual monthly subscription",
    priceKobo: 170000,
    minAmountKobo: null,
    maxAmountKobo: null,
  },
  {
    id: "subscription-showmax",
    category: "digital_subscription",
    provider: "Showmax",
    name: "Entertainment · 1 month",
    description: "Showmax Entertainment monthly subscription",
    priceKobo: 400000,
    minAmountKobo: null,
    maxAmountKobo: null,
  },
];

let seedPromise: Promise<void> | undefined;

export async function ensureSampleCatalog(): Promise<void> {
  seedPromise ??= db
    .insert(serviceProductsTable)
    .values(sampleProducts)
    .onConflictDoNothing()
    .then(() => undefined);
  await seedPromise;
}

export async function listActiveProducts() {
  await ensureSampleCatalog();
  return db
    .select()
    .from(serviceProductsTable)
    .where(eq(serviceProductsTable.isActive, true))
    .orderBy(serviceProductsTable.category, serviceProductsTable.provider);
}

export function serializeProduct(product: ServiceProduct) {
  return {
    id: product.id,
    category: product.category,
    provider: product.provider,
    name: product.name,
    description: product.description,
    priceKobo: product.priceKobo,
    minAmountKobo: product.minAmountKobo,
    maxAmountKobo: product.maxAmountKobo,
  };
}