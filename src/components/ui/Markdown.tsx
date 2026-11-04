import { Fragment, type ReactNode } from "react";

/* Minimal, safe markdown for model answers: paragraphs, headings, bullet/numbered lists, **bold**, *italic*,
   `code` and [links](https://…). No raw HTML is ever rendered. */

function inline(text: string, key: string): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\((https?:\/\/[^)\s]+)\)|\*[^*\s][^*]*\*)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const t = m[0];
    const k = `${key}-${i++}`;
    if (t.startsWith("**")) out.push(<strong key={k}>{t.slice(2, -2)}</strong>);
    else if (t.startsWith("`")) out.push(<code key={k}>{t.slice(1, -1)}</code>);
    else if (t.startsWith("[")) out.push(<a key={k} href={m[2]} target="_blank" rel="noreferrer">{t.slice(1, t.indexOf("]"))}</a>);
    else out.push(<em key={k}>{t.slice(1, -1)}</em>);
    last = m.index + t.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

export function Markdown({ text, className }: { text: string; className?: string }) {
  const blocks: ReactNode[] = [];
  const lines = text.replace(/\r/g, "").split("\n");
  let list: { ordered: boolean; items: string[] } | null = null;
  let para: string[] = [];
  const flushPara = () => { if (para.length) blocks.push(<p key={`p${blocks.length}`}>{inline(para.join(" "), `p${blocks.length}`)}</p>); para = []; };
  const flushList = () => {
    if (!list) return;
    const k = `l${blocks.length}`;
    const items = list.items.map((it, j) => <li key={j}>{inline(it, `${k}-${j}`)}</li>);
    blocks.push(list.ordered ? <ol key={k}>{items}</ol> : <ul key={k}>{items}</ul>);
    list = null;
  };
  for (const raw of lines) {
    const line = raw.trimEnd();
    const bullet = /^\s*[-*•]\s+(.*)$/.exec(line);
    const num = /^\s*\d+[.)]\s+(.*)$/.exec(line);
    const head = /^#{1,4}\s+(.*)$/.exec(line);
    if (bullet || num) {
      flushPara();
      const ordered = !!num;
      if (list && list.ordered !== ordered) flushList();
      if (!list) list = { ordered, items: [] };
      list.items.push((bullet ?? num)![1]);
    } else if (head) {
      flushPara(); flushList();
      blocks.push(<h4 key={`h${blocks.length}`}>{inline(head[1], `h${blocks.length}`)}</h4>);
    } else if (!line.trim()) {
      flushPara(); flushList();
    } else {
      flushList();
      para.push(line.trim());
    }
  }
  flushPara(); flushList();
  return <div className={`ui-md${className ? ` ${className}` : ""}`}>{blocks.map((b, i) => <Fragment key={i}>{b}</Fragment>)}</div>;
}
