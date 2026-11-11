/** Normalize scraped price + currency into one clean on-screen price string. */

const CURRENCY_HINTS: Array<{ re: RegExp; code: string }> = [
  { re: /\bHKD\b|HK\$|港币|港幣/i, code: "HKD" },
  { re: /\bJPY\b|￥|日元|日圓/i, code: "JPY" },
  { re: /\bCNY\b|\bRMB\b|人民币|人民幣/i, code: "CNY" },
  // Bare 元 alone is too ambiguous (and locale must not force ¥) — require CNY/RMB/人民币.
  { re: /\bUSD\b|US\$/i, code: "USD" },
  { re: /\bEUR\b|€/i, code: "EUR" },
  { re: /\bGBP\b|£/i, code: "GBP" },
  // Bare $ last — only when no more specific currency matched
  { re: /\$/i, code: "USD" },
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
  // Do not invent CNY/JPY just because locale is zh — e.g. zh + HKD pages.
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

/** Marketplace / storefront hosts — never treat these (or their site names) as the product brand. */
const MARKETPLACE_HOST_RE =
  /amazon\.|amzn\.|ebay\.|etsy\.|shopify\.|myshopify\.com|tmall\.|taobao\.|jd\.com|rakuten\.|aliexpress\.|walmart\.|target\.com|mercari\.|yahoo\.|coupang\.|shopee\.|lazada\.|bestbuy\.|newegg\./i;

const MARKETPLACE_SITE_NAME_RE =
  /^(amazon|ebay|etsy|shopify|tmall|taobao|rakuten|aliexpress|walmart|target|mercari|yahoo|coupang|shopee|lazada|bestbuy|newegg|京东|天猫|淘宝)([.\s]|$)/i;

export function isMarketplaceHost(host: string): boolean {
  const h = host.replace(/^www\./, "").trim();
  return MARKETPLACE_HOST_RE.test(h);
}

function hostLabel(host: string): string {
  return host.replace(/^www\./, "").split(".")[0]?.toLowerCase() || "";
}

/**
 * Prefer JSON-LD / explicit brand. Never use a marketplace hostname (or site name)
 * as brand — host-agnostic, not Amazon-only. Fall back to a leading title token.
 */
export function resolveProductBrand(opts: {
  brand: string | null | undefined;
  title: string;
  urlHost: string;
  ogSiteName?: string | null;
}): string {
  const host = opts.urlHost.replace(/^www\./, "").trim();
  const label = hostLabel(host);
  const candidates = [opts.brand, opts.ogSiteName]
    .map((s) => (s || "").trim())
    .filter(Boolean);

  for (const c of candidates) {
    const lower = c.toLowerCase().trim();
    if (!lower) continue;
    if (lower === host.toLowerCase()) continue;
    if (lower === label) continue;
    if (MARKETPLACE_SITE_NAME_RE.test(lower)) continue;
    if (MARKETPLACE_HOST_RE.test(c)) continue;
    // Hostname-shaped strings are not product brands on marketplace PDPs
    if (
      /^(www\.)?[a-z0-9-]+(\.[a-z0-9-]+)+$/i.test(c) &&
      (isMarketplaceHost(host) || lower.includes(label))
    ) {
      continue;
    }
    return c.slice(0, 40);
  }

  // Title often starts with brand: "Lenovo Idea Tab…" / "联想 Idea Tab…" / "Acme Ceramic Mug"
  const title = opts.title.trim();
  const m = title.match(/^([\u4e00-\u9fffA-Za-z][\u4e00-\u9fffA-Za-z0-9&.+\-]{1,24})\b/);
  if (m && m[1].toLowerCase() !== host.toLowerCase() && m[1].toLowerCase() !== label) {
    if (!MARKETPLACE_SITE_NAME_RE.test(m[1])) {
      return m[1].slice(0, 40);
    }
  }

  // Last resort for marketplace pages: short title token — never the host
  if (isMarketplaceHost(host)) {
    return (m?.[1] || title.slice(0, 24) || "Brand").slice(0, 40);
  }
  // Brand's own site: host is acceptable only when nothing else is available
  return (m?.[1] || host || "Brand").slice(0, 40);
}
