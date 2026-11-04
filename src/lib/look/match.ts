/*
 * Matches an item's verbatim text to the grounded lines that carry it. Spark localises single lines far better
 * than whole items, so boxes come from the line transcription and the reading call only says WHAT to box.
 */
import type { Box } from "./types";

export interface GroundedLine {
  n: number;
  text: string;
  box: Box;
}

const tokens = (s: string): string[] => s.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];

function near(a: string, b: string): boolean {
  if (a === b) return true;
  if (a.length < 4 || b.length < 4 || Math.abs(a.length - b.length) > 1) return false;
  if (a.length === 4 && b.length !== 4) return false;
  // One substitution or one insertion: tolerates a misread glyph between the two transcriptions.
  const [s, l] = a.length <= b.length ? [a, b] : [b, a];
  let i = 0;
  let j = 0;
  let miss = 0;
  while (i < s.length && j < l.length) {
    if (s[i] === l[j]) { i++; j++; continue; }
    if (++miss > 1) return false;
    if (s.length === l.length) i++;
    j++;
  }
  return miss + (l.length - j) + (s.length - i) <= 1;
}

/** Share of `want` tokens found in `have` (each have-token used once). */
function cover(want: string[], have: string[]): { hit: number; used: number } {
  const pool = [...have];
  let hit = 0;
  for (const w of want) {
    const k = pool.findIndex((h) => near(w, h));
    if (k >= 0) { hit++; pool.splice(k, 1); }
  }
  return { hit, used: have.length - pool.length };
}

export const unionBox = (bs: Box[]): Box => [Math.min(...bs.map((b) => b[0])), Math.min(...bs.map((b) => b[1])), Math.max(...bs.map((b) => b[2])), Math.max(...bs.map((b) => b[3]))];

/** Lines that belong together on the page: stacked closely (a wrapped sentence, a button's letter, title and caption) with overlapping x ranges. */
function adjacent(group: Box, l: Box): boolean {
  const gapY = Math.max(0, l[1] - group[3], group[1] - l[3]);
  const minH = Math.min(group[3] - group[1], l[3] - l[1]);
  const overlap = Math.min(group[2], l[2]) - Math.max(group[0], l[0]);
  const minW = Math.min(group[2] - group[0], l[2] - l[0]);
  return gapY <= minH + 6 && minW > 0 && overlap >= 0.4 * minW;
}

/**
 * Best group of lines for `text`: starts from each line in turn and greedily adds neighbouring lines while the score
 * improves (share of the item's words found, minus a penalty for words the item does not contain). Order in the
 * transcription does not matter, only position, so a button laid out in a grid still matches. Returns the lines
 * sorted by reading order, or null below `minScore`.
 */
export function matchLines(text: string, lines: GroundedLine[], opts: { maxRun?: number; minScore?: number } = {}): GroundedLine[] | null {
  const want = tokens(text);
  if (!want.length || !lines.length) return null;
  const maxRun = opts.maxRun ?? 6;
  const toks = lines.map((l) => tokens(l.text));
  const scoreOf = (idx: number[]): number => {
    const have = idx.flatMap((i) => toks[i]);
    if (!have.length) return -1;
    const { hit } = cover(want, have);
    return hit / want.length - 0.6 * ((have.length - hit) / have.length);
  };
  let best: { score: number; idx: number[] } | null = null;
  for (let seed = 0; seed < lines.length; seed++) {
    let idx = [seed];
    let score = scoreOf(idx);
    while (idx.length < maxRun) {
      const group = unionBox(idx.map((i) => lines[i].box));
      let next: { i: number; score: number } | null = null;
      for (let i = 0; i < lines.length; i++) {
        if (idx.includes(i) || !adjacent(group, lines[i].box)) continue;
        const sc = scoreOf([...idx, i]);
        if (sc > score + 1e-9 && (!next || sc > next.score)) next = { i, score: sc };
      }
      if (!next) break;
      idx = [...idx, next.i];
      score = next.score;
    }
    if (!best || score > best.score + 1e-9 || (Math.abs(score - best.score) <= 1e-9 && idx.length < best.idx.length)) best = { score, idx };
  }
  if (!best || best.score < (opts.minScore ?? 0.55)) return null;
  return best.idx.map((i) => lines[i]).sort((a, b) => a.n - b.n);
}
