import { sha256Hex } from "../server/util";

export const normQuery = (q: string) => q.toLowerCase().replace(/\s+/g, " ").trim();

/** Stable cache key for a URL: no fragment, no tracking params, no trailing slash. */
export function normUrl(u: string): string {
  try {
    const url = new URL(u.trim());
    url.hash = "";
    for (const k of [...url.searchParams.keys()]) if (/^(utm_|fbclid|gclid)/i.test(k)) url.searchParams.delete(k);
    return (url.origin + url.pathname.replace(/\/+$/, "") + url.search).toLowerCase();
  } catch {
    return u.trim().toLowerCase();
  }
}

export const shortHash = async (s: string) => (await sha256Hex(s)).slice(0, 32);

/** Split page text into passages of roughly `size` characters on paragraph and sentence edges. */
export function chunkText(text: string, size = 900): string[] {
  const clean = text
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/^\s*[*-]\s+(Przejdź|Skip|Menu).*$/gim, "");
  const paras = clean.replace(/\r/g, "").split(/\n{2,}|\n(?=[#*-]\s)/).map((p) => p.replace(/\s+/g, " ").trim()).filter((p) => p.length > 30);
  const out: string[] = [];
  let cur = "";
  const push = () => {
    if (cur.length > 40) out.push(cur.trim());
    cur = "";
  };
  for (const p of paras) {
    const pieces = p.length > size ? (p.match(new RegExp(`.{1,${size}}(?:\\s|$)`, "g")) ?? [p]) : [p];
    for (const piece of pieces) {
      if (cur && cur.length + piece.length > size) push();
      cur += (cur ? " " : "") + piece;
    }
  }
  push();
  return out;
}
