// Normalizes an incoming Vetted-approved product record into the Help a Pet
// mirror shape. Every ingestion adapter (admin file import today, an API/feed
// adapter once Vetted confirms the delivery method) funnels through this file,
// so adding a new adapter never touches the schema or the storefront.

export type RawRow = Record<string, unknown>;

export interface NormalizedProduct {
  source_product_id: string;
  name: string;
  description: string | null;
  image_url: string | null;
  external_url: string;
  store_name: string | null;
  brand: string | null;
  category: string;
  price_text: string | null;
  price_amount: number | null;
  currency: string | null;
  sku: string | null;
  tags: string[];
  approved: boolean;
  approval_status: string;
  raw_payload: RawRow;
}

// Accepted header spellings per field. Matching is case/space/underscore
// insensitive so a Vetted export can use almost any reasonable column naming.
const ALIASES: Record<string, string[]> = {
  source_product_id: ["source_product_id", "product_id", "id", "vetted_id", "external_id", "uid"],
  name: ["name", "product_name", "title", "product"],
  description: ["description", "product_description", "summary", "details"],
  image_url: ["image_url", "image", "photo", "photo_url", "thumbnail", "image_link"],
  external_url: ["external_url", "url", "product_url", "link", "buy_url", "shop_url", "affiliate_url"],
  store_name: ["store_name", "store", "retailer", "merchant", "seller", "vendor"],
  brand: ["brand", "manufacturer", "make"],
  category: ["category", "product_category", "type", "department"],
  price_text: ["price_text", "price_display", "price_label"],
  price_amount: ["price_amount", "price", "amount", "cost", "msrp"],
  currency: ["currency", "currency_code"],
  sku: ["sku", "upc", "gtin", "model", "part_number"],
  tags: ["tags", "labels", "keywords"],
  approval_status: ["approval_status", "status", "vetted_status", "state"],
  approved: ["approved", "is_approved", "vetted_approved"],
};

const CATEGORY_MAP: Record<string, string> = {
  food: "food", foods: "food", nutrition: "food", treats: "food", diet: "food",
  toy: "toys", toys: "toys", play: "toys", enrichment: "toys",
  health: "health", supplement: "health", supplements: "health", medical: "health",
  medicine: "health", wellness: "health", grooming: "health",
  accessory: "accessories", accessories: "accessories", gear: "accessories",
  apparel: "accessories", collar: "accessories", leash: "accessories", bedding: "accessories",
};

const key = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

function pick(row: RawRow, field: string): unknown {
  const wanted = (ALIASES[field] ?? [field]).map(key);
  for (const [k, v] of Object.entries(row)) {
    if (wanted.includes(key(k))) {
      if (v === null || v === undefined) continue;
      if (typeof v === "string" && v.trim() === "") continue;
      return v;
    }
  }
  return undefined;
}

const str = (v: unknown): string | null => {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s === "" ? null : s;
};

function num(v: unknown): number | null {
  const s = str(v);
  if (s === null) return null;
  const cleaned = s.replace(/[^0-9.\-]/g, "");
  if (cleaned === "" || cleaned === "-" || cleaned === ".") return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : null;
}

function toTags(v: unknown): string[] {
  if (Array.isArray(v)) return v.map((t) => String(t).trim()).filter(Boolean);
  const s = str(v);
  if (!s) return [];
  return s.split(/[;,|]/).map((t) => t.trim()).filter(Boolean);
}

function toCategory(v: unknown): string {
  const s = str(v);
  if (!s) return "general";
  return CATEGORY_MAP[s.toLowerCase().trim()] ?? "general";
}

/** Vetted is the source of truth for approval: anything not clearly approved is skipped. */
function resolveApproval(row: RawRow): { approved: boolean; approval_status: string } {
  const rawStatus = str(pick(row, "approval_status"));
  const rawFlag = pick(row, "approved");

  if (rawFlag !== undefined) {
    const f = String(rawFlag).trim().toLowerCase();
    const truthy = ["true", "t", "yes", "y", "1", "approved"].includes(f);
    return { approved: truthy, approval_status: rawStatus?.toLowerCase() ?? (truthy ? "approved" : "not_approved") };
  }
  if (rawStatus) {
    const s = rawStatus.toLowerCase();
    return { approved: ["approved", "active", "listed", "published", "vetted"].includes(s), approval_status: s };
  }
  // No approval column at all: the file itself is the approved catalog export.
  return { approved: true, approval_status: "approved" };
}

export function normalizeProduct(row: RawRow, index: number): { product?: NormalizedProduct; error?: string } {
  const name = str(pick(row, "name"));
  const externalUrl = str(pick(row, "external_url"));
  if (!name) return { error: `Row ${index + 1}: missing product name` };
  if (!externalUrl) return { error: `Row ${index + 1} (${name}): missing product URL` };
  if (!/^https?:\/\//i.test(externalUrl)) return { error: `Row ${index + 1} (${name}): product URL must start with http(s)` };

  const sourceId = str(pick(row, "source_product_id")) ?? str(pick(row, "sku")) ?? externalUrl;
  const amount = num(pick(row, "price_amount"));
  const currency = str(pick(row, "currency"))?.toUpperCase() ?? (amount !== null ? "USD" : null);
  const priceText = str(pick(row, "price_text")) ??
    (amount !== null ? `${currency === "USD" ? "$" : `${currency} `}${amount.toFixed(2)}` : null);
  const { approved, approval_status } = resolveApproval(row);

  return {
    product: {
      source_product_id: sourceId,
      name,
      description: str(pick(row, "description")),
      image_url: str(pick(row, "image_url")),
      external_url: externalUrl,
      store_name: str(pick(row, "store_name")),
      brand: str(pick(row, "brand")),
      category: toCategory(pick(row, "category")),
      price_text: priceText,
      price_amount: amount,
      currency,
      sku: str(pick(row, "sku")),
      tags: toTags(pick(row, "tags")),
      approved,
      approval_status,
      raw_payload: row,
    },
  };
}
