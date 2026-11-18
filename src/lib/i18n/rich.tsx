import { Fragment, type ReactNode } from "react";

/** Puts React nodes into a translated sentence: rich(t("agree", { terms: "{terms}" }), { terms: <Link …>…</Link> }).
 *  Simplest use: rich(t("agree"), { terms: <Link/> }) where the message contains "{terms}". Unknown tokens stay as text. */
export function rich(message: string, nodes: Record<string, ReactNode>): ReactNode {
  const parts = message.split(/(\{\w+\})/g);
  return parts.map((p, i) => {
    const k = /^\{(\w+)\}$/.exec(p)?.[1];
    return <Fragment key={i}>{k && k in nodes ? nodes[k] : p}</Fragment>;
  });
}
