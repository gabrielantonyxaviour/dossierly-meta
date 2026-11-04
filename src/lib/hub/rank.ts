/*
 * Passage ranking for the hub: plain keyword overlap. There is no embeddings model, and the 1M-token context
 * means the relevant official text goes straight to the model instead of through a vector index.
 */
export interface Passage {
  id: string;
  url: string;
  title: string;
  text: string;
}
export interface Ranked extends Passage {
  score: number;
}

const tokens = (s: string) => new Set(s.toLowerCase().match(/[\p{L}\p{N}]{3,}/gu) ?? []);

export function lexicalRank(query: string, passages: Passage[], k: number): Ranked[] {
  const q = tokens(query);
  return passages
    .map((p) => {
      const t = tokens(p.text);
      let hit = 0;
      for (const w of q) if (t.has(w)) hit++;
      return { ...p, score: q.size ? hit / q.size : 0 };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, k);
}
