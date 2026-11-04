import { runLabel, usd } from "@/lib/client/format";
import type { Run } from "@/lib/client/types";

/** Subtle per-result model attribution: "Muse Spark · 0.9 s". Replays carry a "recorded" badge. */
export function Attribution({ run, runs, prefix }: { run?: Run; runs?: Run[]; prefix?: string }) {
  const list = runs?.length ? runs : run ? [run] : [];
  if (!list.length) return null;
  const replay = list.every((r) => r.ranOn === "replay");
  const cost = list.reduce((s, r) => s + r.costUsd, 0);
  return (
    <span className="attribution" title={`Total ${usd(cost)} · ${list.reduce((s, r) => s + r.tokensIn + r.tokensOut, 0)} tokens`}>
      <span className={`dot${replay ? " replay" : ""}`} aria-hidden="true" />
      {prefix ? `${prefix} · ` : ""}
      {[...new Map(list.map((r) => [r.model, r])).values()].map((r) => runLabel({ ...r, ms: list.filter((x) => x.model === r.model).reduce((s, x) => s + x.ms, 0) })).join(" + ")}
      {replay && <span className="chip" style={{ minHeight: 20, fontSize: "0.7rem" }}>recorded</span>}
    </span>
  );
}
