/** Normalize scraped price + currency into one clean on-screen price string. */

const CURRENCY_HINTS: Array<{ re: RegExp; code: string }> = [
  { re: /\bHKD\b|HK\$|港币|港幣/i, code: "HKD" },
  { re: /\bJPY\b|￥|日元|日圓/i, code: "JPY" },
  { re: /\bCNY\b|\bRMB\b|元|人民币|人民幣/i, code: "CNY" },
  { re: /\bUSD\b|US\$|\$/i, code: "USD" },
  { re: /\bEUR\b|€/i, code: "EUR" },
  { re: /\bGBP\b|£/i, code: "GBP" },
];

export function detectCurrency(
  priceRaw: string | null | undefined,
  currencyRaw: string | null | undefined,
  localeHint?: string,
): string | null {
  const cur = (currencyRaw || "").trim().toUpperCase();
  if (cur && /^[A-Z]{3}$/.test(cur)) return cur;
  const blob = `${priceRaw || ""} ${currencyRaw || ""}`;
  for (const h of CURRENCY_HINTS) {
    if (h.re.test(blob)) return h.code;
  }
  // Do not invent CNY just because locale is zh — Amazon HK pages are often zh + HKD.
  void localeHint;
  return null;
}

/** Pull the first full numeric amount from a messy price string. */
export function extractAmount(priceRaw: string | null | undefined): string | null {
  if (!priceRaw) return null;
  const cleaned = priceRaw.replace(/\s+/g, " ").trim();
  // Prefer patterns like 1,685.94 or 1685.94 or 1.685,94
  const m =
    cleaned.match(/(?<!\d)(\d{1,3}(?:,\d{3})+(?:\.\d{1,2})?|\d+(?:\.\d{1,2})?)(?!\d)/) ||
    cleaned.match(/(\d+(?:[.,]\d{1,2})?)/);
  if (!m) return null;
  let amount = m[1];
  // Normalize European 1.685,94 → 1685.94 is out of scope; keep as-is if comma is decimal
  if (/^\d{1,3}(\.\d{3})+,\d{1,2}$/.test(amount)) {
    amount = amount.replace(/\./g, "").replace(",", ".");
  } else {
    amount = amount.replace(/,/g, "");
  }
  return amount;
}

export function formatDisplayPrice(
  priceRaw: string | null | undefined,
  currencyRaw: string | null | undefined,
  localeHint?: string,
): string {
  const code = detectCurrency(priceRaw, currencyRaw, localeHint);
  const amount = extractAmount(priceRaw);
  if (!amount) return "";
  if (!code) return amount;
  switch (code) {
    case "HKD":
      return `HK$${amount}`;
    case "USD":
      return `$${amount}`;
    case "EUR":
      return `€${amount}`;
    case "GBP":
      return `£${amount}`;
    case "JPY":
      return `¥${amount}`;
    case "CNY":
      return `¥${amount}`;
    default:
      return `${code} ${amount}`;
  }
}

const MARKETPLACE_HOST_RE =
  /amazon\.|amzn\.|ebay\.|shopify\.|tmall\.|taobao\.|jd\.com|rakuten\.|aliexpress\./i;

/**
 * Prefer JSON-LD / explicit brand. Never use marketplace hostname as brand.
 * Fall back to leading brand token from the title when needed.
 */
export function resolveProductBrand(opts: {
  brand: string | null | undefined;
  title: string;
  urlHost: string;
  ogSiteName?: string | null;
}): string {
  const host = opts.urlHost.replace(/^www\./, "").trim();
  const candidates = [opts.brand, opts.ogSiteName]
    .map((s) => (s || "").trim())
    .filter(Boolean);

  for (const c of candidates) {
    const lower = c.toLowerCase();
    if (lower === host.toLowerCase()) continue;
    // Marketplace site names / hosts are never the product brand
    if (
      /^(amazon|ebay|shopify|tmall|taobao|rakuten|aliexpress)(\.[a-z.]+)?$/i.test(lower) ||
      MARKETPLACE_HOST_RE.test(c)
    ) {
      continue;
    }
    if (/^(www\.)?[a-z0-9-]+\.[a-z]{2,}$/i.test(c) && MARKETPLACE_HOST_RE.test(host)) {
      continue;
    }
    return c.slice(0, 40);
  }

  // Title often starts with brand: "Lenovo Idea Tab…" / "联想 Idea Tab…"
  const title = opts.title.trim();
  const m = title.match(/^([\u4e00-\u9fffA-Za-z][\u4e00-\u9fffA-Za-z0-9&.+\-]{1,24})\b/);
  if (m && m[1].toLowerCase() !== host.toLowerCase()) {
    return m[1].slice(0, 40);
  }

  // Last resort for non-marketplace pages: host; for marketplaces keep a short title token
  if (MARKETPLACE_HOST_RE.test(host)) {
    return (m?.[1] || title.slice(0, 24) || "Brand").slice(0, 40);
  }
  return host.slice(0, 40) || "Brand";
}
