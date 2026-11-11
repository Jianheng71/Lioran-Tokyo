import fs from "node:fs";

/** URL patterns that are site chrome, sprites, favicons, or tiny thumbs — never product heroes. */
const REJECT_URL_RE =
  /favicon|apple-touch-icon|sprite|spritesheet|icon[_-]?set|transparent[_-]?pixel|spacer\.|1x1|pixel\.gif|blank\.|loading[_-]?spinner|badge|cart[_-]?icon|prime[_-]?logo|smile[_-]?(?:logo|icon)|nav[_-]?logo|\/icons?\//i;

/** Amazon (and similar CDN) size tokens that mean tiny thumbs. */
const TINY_SIZE_RE = /[._-](?:SS|SX|SY|US|UX|UY|AC_US|AC_UL|AC_SX|AC_SY|_SL)(?:20|32|40|50|60|70|75|80|90|100)(?:[._,]|$)/i;

export function isRejectImageUrl(url: string): boolean {
  if (!url) return true;
  if (REJECT_URL_RE.test(url)) return true;
  if (TINY_SIZE_RE.test(url)) return true;
  // data: URIs and SVG icons are not product heroes
  if (/^data:image\/svg/i.test(url)) return true;
  return false;
}

/** Prefer larger Amazon-style media when rewriting is safe. */
export function preferLargerImageUrl(url: string): string {
  try {
    // Common Amazon thumb → larger product media
    if (/media-amazon\.com|ssl-images-amazon\.com/i.test(url)) {
      return url
        .replace(/\._[A-Z]{2}\d+_[A-Z]{2}\d+_\./g, ".")
        .replace(/\._AC_[^.]+_\./g, "._AC_SL1500_.")
        .replace(/\._SS\d+_\./g, "._AC_SL1500_.")
        .replace(/\._SX\d+_\./g, "._AC_SL1500_.");
    }
  } catch {
    // keep original
  }
  return url;
}

function readPngSize(buf: Buffer): { width: number; height: number } | null {
  if (buf.length < 24) return null;
  if (buf.toString("ascii", 1, 4) !== "PNG") return null;
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

function readJpegSize(buf: Buffer): { width: number; height: number } | null {
  if (buf.length < 4 || buf[0] !== 0xff || buf[1] !== 0xd8) return null;
  let i = 2;
  while (i + 9 < buf.length) {
    if (buf[i] !== 0xff) {
      i += 1;
      continue;
    }
    const marker = buf[i + 1];
    if (marker === 0xd9 || marker === 0xda) break;
    const len = buf.readUInt16BE(i + 2);
    if (len < 2) break;
    // SOF0 / SOF2
    if (marker === 0xc0 || marker === 0xc2) {
      return { height: buf.readUInt16BE(i + 5), width: buf.readUInt16BE(i + 7) };
    }
    i += 2 + len;
  }
  return null;
}

export function readImageSize(filePath: string): { width: number; height: number } | null {
  try {
    const buf = fs.readFileSync(filePath);
    return readPngSize(buf) || readJpegSize(buf);
  } catch {
    return null;
  }
}

/** Minimum edge for a usable product hero (rejects 40×40 icon collages). */
export const MIN_HERO_EDGE = 160;

export function isUsableHeroFile(filePath: string): boolean {
  try {
    const st = fs.statSync(filePath);
    if (st.size < 4_000) return false;
    const size = readImageSize(filePath);
    if (!size) {
      // Unknown format (webp etc.): accept if file is reasonably large
      return st.size >= 12_000;
    }
    return size.width >= MIN_HERO_EDGE && size.height >= MIN_HERO_EDGE;
  } catch {
    return false;
  }
}
