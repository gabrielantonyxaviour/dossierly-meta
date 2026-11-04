/*
 * Incremental parser for the line protocol the voice prompts ask Spark for:
 *   KEY: value\nKEY: value ...
 * A line without a KEY continues the previous field; leading unlabeled text belongs to `fallbackKey`.
 * Fields named in `speak` are released sentence by sentence while they stream, so speech starts before the line ends.
 * Outputs are short, so each push simply re-parses the whole buffer.
 */

const KEY_RE = /^([A-Z][A-Z_]{1,15}):\s?(.*)$/;
const SENTENCE = /[.?!。？！।]+(?=\s)/g;
/** First words of a field: a clause break after this many characters already starts speech. */
const FIRST_CLAUSE = /^.{24,}?[,;:—–](?=\s)/su;

export interface LineHandlers {
  onField(key: string, value: string): void;
  onSentence?(key: string, sentence: string): void;
}

export function parseFields(raw: string, fallbackKey = "SAY"): Array<{ key: string; value: string }> {
  const out: Array<{ key: string; value: string }> = [];
  for (const line of raw.split("\n")) {
    const m = KEY_RE.exec(line.trim());
    if (m) out.push({ key: m[1], value: m[2] });
    else if (line.trim()) {
      if (!out.length) out.push({ key: fallbackKey, value: line.trim() });
      else out[out.length - 1].value += (out[out.length - 1].value ? " " : "") + line.trim();
    }
  }
  return out.map((f) => ({ key: f.key, value: f.value.trim() }));
}

export class LineStream {
  private raw = "";
  private released: number[] = [];
  private done: boolean[] = [];

  constructor(private h: LineHandlers, private speak: Set<string>, private fallbackKey = "SAY") {}

  get text(): string {
    return this.raw;
  }

  push(delta: string): void {
    this.raw += delta;
    this.step(false);
  }

  end(): void {
    this.step(true);
  }

  private step(final: boolean): void {
    const fields = parseFields(this.raw, this.fallbackKey);
    fields.forEach((f, i) => {
      if (this.done[i]) return;
      const complete = final || i < fields.length - 1;
      if (this.speak.has(f.key) && this.h.onSentence) {
        let from = this.released[i] ?? 0;
        const rest = f.value.slice(from);
        let last = 0;
        for (const m of rest.matchAll(SENTENCE)) last = m.index + m[0].length;
        // Speech starts on the first clause; later text goes sentence by sentence.
        if (!last && !from && !complete) last = FIRST_CLAUSE.exec(rest)?.[0].length ?? 0;
        if (last > 0) {
          const s = rest.slice(0, last).trim();
          if (s) this.h.onSentence(f.key, s);
          from += last;
        }
        if (complete) {
          const tail = f.value.slice(from).trim();
          if (tail) this.h.onSentence(f.key, tail);
          from = f.value.length;
        }
        this.released[i] = from;
      }
      if (complete) {
        this.done[i] = true;
        if (f.value) this.h.onField(f.key, f.value);
      }
    });
  }
}
