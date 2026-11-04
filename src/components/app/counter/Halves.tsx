"use client";

import { useEffect, useRef, useState } from "react";
import type { AgentCall } from "@/lib/voice/client/useAgentCall";
import { LANG_NAME, type CoachNote, type VoiceTurn } from "@/lib/voice/protocol";
import { Captured } from "@/components/voice/bits";
import { OfficialDoc } from "./OfficialDoc";

function useAutoScroll(dep: unknown) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.scrollTo({ top: ref.current.scrollHeight, behavior: "smooth" });
  }, [dep]);
  return ref;
}

/** What the official should read: the user's words in Polish, plus their own words as heard. */
export function OfficialHalf({ call }: { call: AgentCall }) {
  const ref = useAutoScroll(call.turns);
  const doc = call.docs[call.docs.length - 1] ?? null;
  const turns = call.turns.slice(doc ? -2 : -5);
  return (
    <section className={`ct-half ct-half-official ${doc ? "has-doc" : ""}`} lang="pl" aria-label="Dla urzędnika (Polish)">
      <header className="ct-label">
        <b>Dla urzędnika</b>
        <span>Dossierly tłumaczy rozmowę na żywo · asystent AI</span>
      </header>
      <div className="ct-turns" ref={ref}>
        {!turns.length && <p className="ct-empty">Dzień dobry. Ten telefon tłumaczy rozmowę z polskiego i na polski. Proszę mówić normalnie.</p>}
        {turns.map((t) =>
          t.who === "user" ? (
            <p key={t.id} className="ct-big">{t.translation || <span className="ct-wait">…</span>}</p>
          ) : (
            <p key={t.id} className="ct-heard"><span>Usłyszane</span>{t.text}</p>
          ),
        )}
        {call.partial && <p className="ct-heard is-partial"><span>Słucham</span>{call.partial}</p>}
      </div>
      {doc && <OfficialDoc key={doc.docId} doc={doc} onClose={() => call.dismissDoc(doc.docId)} />}
    </section>
  );
}

function Coach({ n }: { n: CoachNote }) {
  return (
    <div className={`ct-coach ${n.toOfficial ? "is-asked" : ""}`}>
      <small>{n.toOfficial ? "Dossierly asked the official instead" : "What this means for your case"}</small>
      <p>{n.toUser}</p>
      {n.toOfficial && (
        <p className="ct-asked" lang="pl">
          &ldquo;{n.toOfficial}&rdquo;{n.toOfficialGloss && <span>{n.toOfficialGloss}</span>}
        </p>
      )}
    </div>
  );
}

type Item = { kind: "turn"; t: VoiceTurn } | { kind: "coach"; n: CoachNote };

/** The user's half: the official's words in their language, coaching, and what was added to the case. */
export function UserHalf({ call }: { call: AgentCall }) {
  const [showAll, setShowAll] = useState(false);
  const items: Item[] = [];
  for (const t of call.turns) {
    items.push({ kind: "turn", t });
    for (const n of call.coach.filter((c) => c.turnId === t.id)) items.push({ kind: "coach", n });
  }
  const shown = showAll ? items : items.slice(-6);
  const ref = useAutoScroll(items.length + (call.turns[call.turns.length - 1]?.translation?.length ?? 0));
  const lang = LANG_NAME[call.lang] ?? "English";
  return (
    <section className="ct-half ct-half-user" aria-label={`For you (${lang})`}>
      <header className="ct-label">
        <b>For you</b>
        <span>{lang}</span>
        {items.length > 6 && <button className="ct-more" onClick={() => setShowAll((v) => !v)}>{showAll ? "Recent" : "Whole conversation"}</button>}
      </header>
      <div className="ct-turns" ref={ref}>
        {!items.length && <p className="ct-empty">Listening. Speak when you are ready, or let the official start.</p>}
        {shown.map((it) =>
          it.kind === "coach" ? (
            <Coach key={`${it.n.turnId}-${it.n.toUser.slice(0, 12)}`} n={it.n} />
          ) : it.t.who === "official" ? (
            <div key={it.t.id} className="ct-said">
              <small>Official said{it.t.via === "clip" ? " · test official" : ""}</small>
              <p className="ct-big">{it.t.translation || <span className="ct-wait">…</span>}</p>
            </div>
          ) : (
            <p key={it.t.id} className="ct-you"><span>You</span>{it.t.text}</p>
          ),
        )}
        {call.partial && <p className="ct-you is-partial"><span>Hearing</span>{call.partial}</p>}
      </div>
      <Captured items={call.captured.slice(-2)} />
      {call.error && <p className="vc-error ct-error" role="alert">{call.error}</p>}
    </section>
  );
}
