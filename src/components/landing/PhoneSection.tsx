"use client";

import Link from "next/link";
import { useState } from "react";
import { Icon, type IconName } from "@/components/Icon";

type Tab = "intro" | "table" | "watch" | "wrap";
const TABS: { id: Tab; label: string; icon: IconName }[] = [
  { id: "intro", label: "Introduction card", icon: "file" },
  { id: "table", label: "Table mode", icon: "flip" },
  { id: "watch", label: "Watcher", icon: "shield" },
  { id: "wrap", label: "Wrap-up", icon: "check" },
];

function Screen({ tab }: { tab: Tab }) {
  if (tab === "intro") {
    return (
      <div className="lp-ph-screen lp-ph-intro">
        <span className="lp-ph-k">Show this to the official</span>
        <p lang="pl" className="lp-ph-big">Dzień dobry. Nie mówię dobrze po polsku. Ta aplikacja tłumaczy naszą rozmowę.</p>
        <p className="lp-ph-en">Hello. I don&apos;t speak Polish well. This app interprets our conversation.</p>
        <span className="lp-ph-pill">Start interpreting</span>
      </div>
    );
  }
  if (tab === "table") {
    return (
      <div className="lp-ph-screen lp-ph-table">
        <div className="lp-ph-half lp-ph-flip">
          <span className="lp-ph-k">Urzędnik · po polsku</span>
          <p lang="pl">„Brakuje potwierdzenia ubezpieczenia zdrowotnego.”</p>
        </div>
        <span className="lp-ph-mid"><Icon name="flip" size={13} /></span>
        <div className="lp-ph-half">
          <span className="lp-ph-k">You · English</span>
          <p>Proof of health insurance is missing.</p>
          <div className="lp-ph-mics"><span><Icon name="mic" size={16} /></span><span className="is-you"><Icon name="mic" size={16} /></span></div>
        </div>
      </div>
    );
  }
  if (tab === "watch") {
    return (
      <div className="lp-ph-screen">
        <div className="lp-ph-bubble lp-ph-off" lang="pl">„Ma pan czternaście dni na odpowiedź.”</div>
        <div className="lp-ph-bubble lp-ph-me">You have fourteen days to reply.</div>
        <div className="lp-ph-card">
          <span className="lp-ph-k"><span className="lp-dot-live" aria-hidden="true" />Watcher</span>
          <p>A number of days could be misheard. Ask before you leave:</p>
          <p lang="pl" className="lp-ph-ask">„Czy chodzi o czternaście dni?”</p>
        </div>
      </div>
    );
  }
  return (
    <div className="lp-ph-screen">
      <div className="lp-ph-card">
        <span className="lp-ph-k">Wrap-up · Fri 18 Sep</span>
        <p><b>Agreed</b> Fingerprints taken. Passport, photo and fee receipts accepted.</p>
        <p><b>To bring</b> Proof of health insurance for the whole stay.</p>
        <p><b>Dates</b> None yet. A letter will follow.</p>
      </div>
      <span className="lp-ph-pill"><Icon name="calendar" size={13} /> Add to calendar</span>
    </div>
  );
}

/** "The phone that answers for you", Dossierly's way: table mode on a phone, with tabs for each moment. */
export function PhoneSection() {
  const [tab, setTab] = useState<Tab>("table");
  return (
    <section className="lp-sec" aria-labelledby="phone-h">
      <div className="lp-wrap">
        <header className="lp-head-c">
          <svg className="lp-phone-ic" width="32" height="40" viewBox="0 0 32 40" fill="none" aria-hidden="true">
            <rect x="5" y="2" width="22" height="36" rx="6" stroke="currentColor" strokeWidth="2.4" />
            <path d="M13 7h6" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
          </svg>
          <h2 id="phone-h" className="lp-h2" data-sweep>The interpreter that lies flat on the table</h2>
          <p className="lp-body">
            Table mode splits the screen between you and the official. Each of you reads and speaks your own language,
            and the watcher listens for the details that decide a case.
          </p>
          <div className="lp-hero-ctas">
            <Link className="lp-btn lp-btn-dark" href="/signup">Get started</Link>
            <Link className="lp-btn lp-btn-line" href="/signup?start=sample">Try the sample</Link>
          </div>
        </header>
        <div className="lp-ph-tabs" role="tablist" aria-label="Phone screens">
          {TABS.map((t) => (
            <button key={t.id} type="button" role="tab" id={`ph-tab-${t.id}`} aria-selected={tab === t.id}
              aria-controls="ph-panel" className={`lp-tab${tab === t.id ? " is-active" : ""}`} onClick={() => setTab(t.id)}>
              <Icon name={t.icon} size={14} />{t.label}
            </button>
          ))}
        </div>
        <div className="lp-ph-panel" data-reveal>
          <p className="lp-note lp-note-l"><span>Note</span>The official&apos;s half is upside down, so it faces them across the desk</p>
          <div className="lp-ph" id="ph-panel" role="tabpanel" aria-labelledby={`ph-tab-${tab}`}>
            <div className="lp-ph-bar" aria-hidden="true"><span>9:41</span><i /><span>●●●</span></div>
            <div key={tab} className="lp-ph-swap"><Screen tab={tab} /></div>
          </div>
          <p className="lp-note lp-note-r"><span>Note</span>Speech is transcribed by Muse Voice Transcribe. No audio is stored</p>
          <div className="lp-ph-promo">
            <b>Runs in your phone&apos;s browser</b>
            <span>Lay it flat between you and the official.</span>
            <div>
              <Link className="lp-btn lp-btn-dark lp-btn-sm" href="/signup">Get started</Link>
              <Link className="lp-btn lp-btn-ghost lp-btn-sm" href="/limits">Known limits</Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
