"use client";

import { useEffect, useRef, useState } from "react";
import type { AgentCall } from "@/lib/voice/client/useAgentCall";
import { LANG_NAME, type CoachNote, type VoiceTurn } from "@/lib/voice/protocol";
import { Captured } from "@/components/voice/bits";
import { OfficialDoc, preloadCaseFiles } from "./OfficialDoc";

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
  const turns = call.turns.slice(-5);
  useEffect(() => void preloadCaseFiles(), []);
  // While a document is up, the user's newest words in Polish (said with or after it) stay readable under it.
  const [opened, setOpened] = useState<{ id: string; n: number } | null>(null);
  if (doc && opened?.id !== doc.docId) setOpened({ id: doc.docId, n: call.turns.length });
  const from = doc ? call.turns.findIndex((t) => t.id === doc.turnId) : -1;
  const said = (t: VoiceTurn) => (t.who === "user" ? t.translation : t.reply);
  const caption = doc ? call.turns.slice(from >= 0 ? from : opened?.id === doc.docId ? opened.n : call.turns.length).filter((t) => said(t)).map(said).pop() : undefined;
  return (
    <section className={`ct-half ct-half-official ${doc ? "has-doc" : ""}`} lang="pl" aria-label="Dla urzędnika (Polish)">
      <header className="ct-label">
        <b>Dla urzędnika</b>
        <span>Asystent AI Dossierly · mówi w imieniu: {call.userName || "klienta"}</span>
      </header>
      <div className="ct-turns" ref={ref}>
        {!turns.length && !doc && <p className="ct-empty">Dzień dobry. Ten telefon tłumaczy rozmowę z polskiego i na polski. Proszę mówić normalnie.</p>}
        {turns.map((t) =>
          t.who === "user" ? (
            <p key={t.id} className="ct-big">{t.translation || <span className="ct-wait">…</span>}</p>
          ) : (
            <div key={t.id} className="ct-heardblock">
              <p className="ct-heard"><span>Pani</span>{t.text}</p>
              {t.reply && <p className="ct-big ct-reply">{t.reply}</p>}
            </div>
          ),
        )}
        {call.partial && <p className="ct-heard is-partial"><span>Słucham</span>{call.partial}</p>}
      </div>
      {doc && <OfficialDoc key={doc.docId} doc={doc} caption={caption} onClose={() => call.dismissDoc(doc.docId)} />}
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

/** One official turn for the user: what she asked, what Dossierly told her on their behalf, what to do now. */
function Brief({ t }: { t: VoiceTurn }) {
  const b = t.brief ?? {};
  const ask = t.mode === "ask";
  if (!b.asked && !b.told && !b.do) {
    return <div className="ct-brief is-wait"><small>The official</small><p className="ct-wait">…</p></div>;
  }
  return (
    <div className={`ct-brief ${ask ? "is-ask" : ""}`}>
      {b.asked && <div><small>{t.mode === "relay" ? "The official" : "She asked"}</small><p className="ct-asked-q">{b.asked}</p></div>}
      {b.told && <div><small>I told her</small><p>{b.told}</p></div>}
      {b.do && <div className={b.asked || b.told ? "ct-do" : "ct-do is-only"}><small>{ask ? "I need you" : "Dossierly, for you"}</small><p>{b.do}</p></div>}
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
            <Brief key={it.t.id} t={it.t} />
          ) : (
            <div key={it.t.id} className="ct-yourturn">
              <p className="ct-you"><span>You said</span>{it.t.text}</p>
              {it.t.brief?.told && <p className="ct-told">{it.t.brief.told}</p>}
            </div>
          ),
        )}
        {call.partial && <p className="ct-you is-partial"><span>Hearing</span>{call.partial}</p>}
      </div>
      <Captured items={call.captured.slice(-2)} />
      {call.error && <p className="vc-error ct-error" role="alert">{call.error}</p>}
    </section>
  );
}
