import { createHmac } from "node:crypto";

export type WarehouseQuoteSuggestion = {
  id: number;
  model_number: string;
  name: string;
  brand: string;
  category: string;
  location: string;
  latest_price: number | null;
  latest_vendor: string | null;
  latest_currency: string | null;
  latest_quote_number: string | null;
  latest_quantity: number | null;
  latest_quoted_at: string | null;
};

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === "string";
}

function isNullableNumber(value: unknown): value is number | null {
  return value === null || (typeof value === "number" && Number.isFinite(value));
}

function inventoryOrigin() {
  const configured = process.env.INVENTORY_ORIGIN;
  if (!configured) throw new Error("Warehouse inventory is not configured");

  const origin = new URL(configured);
  const localDevelopment = process.env.NODE_ENV !== "production"
    && ["localhost", "127.0.0.1"].includes(origin.hostname);
  const renewDomain = origin.hostname === "renewlighting.com"
    || origin.hostname.endsWith(".renewlighting.com");

  if ((!renewDomain && !localDevelopment) || (origin.protocol !== "https:" && !localDevelopment)) {
    throw new Error("Warehouse inventory origin is not trusted");
  }

  return origin;
}

export async function searchWarehouseQuoteSuggestions(query: string, email: string) {
  const secret = process.env.WAREHOUSE_PROXY_SECRET;
  if (!secret) throw new Error("Warehouse inventory access is not configured");

  const origin = inventoryOrigin();
  const expiresAt = Math.floor(Date.now() / 1000) + 5 * 60;
  const payload = `${email.toLowerCase()}.${expiresAt}`;
  const signature = createHmac("sha256", secret).update(payload).digest("base64url");
  const token = `${payload}.${signature}`;
  const url = new URL("/api/quote-suggestions", origin);
  url.searchParams.set("q", query);

  const response = await fetch(url, {
    headers: { Cookie: `renew_inventory_access=${encodeURIComponent(token)}` },
    cache: "no-store",
    signal: AbortSignal.timeout(5000),
  });
  if (!response.ok) throw new Error(`Warehouse search failed (${response.status})`);

  const suggestions: unknown = await response.json();
  if (!Array.isArray(suggestions)) throw new Error("Warehouse returned an invalid suggestion list");
  return suggestions.map((suggestion): WarehouseQuoteSuggestion => {
    if (!suggestion || typeof suggestion !== "object") {
      throw new Error("Warehouse returned an invalid suggestion");
    }
    const item = suggestion as Record<string, unknown>;
    if (typeof item.id !== "number"
      || !Number.isSafeInteger(item.id)
      || typeof item.model_number !== "string"
      || typeof item.name !== "string"
      || typeof item.brand !== "string"
      || typeof item.category !== "string"
      || typeof item.location !== "string"
      || !isNullableNumber(item.latest_price)
      || !isNullableString(item.latest_currency)
      || !isNullableString(item.latest_vendor)
      || !isNullableString(item.latest_quote_number)
      || !isNullableNumber(item.latest_quantity)
      || !isNullableString(item.latest_quoted_at)) {
      throw new Error("Warehouse returned an invalid suggestion");
    }
    return {
      id: item.id,
      model_number: item.model_number,
      name: item.name,
      brand: item.brand,
      category: item.category,
      location: item.location,
      latest_price: item.latest_price,
      latest_vendor: item.latest_vendor,
      latest_currency: item.latest_currency,
      latest_quote_number: item.latest_quote_number,
      latest_quantity: item.latest_quantity,
      latest_quoted_at: item.latest_quoted_at,
    };
  });
}
