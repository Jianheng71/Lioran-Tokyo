/** Accept only absolute http(s) URLs before they reach the crawler. */
export function assertHttpUrl(raw: string): string {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw Object.assign(new Error("URL must be an absolute http(s) URL"), { status: 400 });
  }
  if ((url.protocol !== "http:" && url.protocol !== "https:") || !url.hostname) {
    throw Object.assign(new Error("URL must be an absolute http(s) URL"), { status: 400 });
  }
  return url.href;
}
