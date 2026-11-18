"use client";

import Link from "next/link";
import { useState } from "react";
import { Icon, type IconName } from "@/components/Icon";
import { useT } from "@/lib/i18n/client";
import type { T } from "@/lib/i18n/translate";

type Tab = "intro" | "table" | "watch" | "wrap";
const TABS: { id: Tab; key: string; icon: IconName }[] = [
  { id: "intro", key: "phTabIntro", icon: "file" },
  { id: "table", key: "phTabTable", icon: "flip" },
  { id: "watch", key: "watcher", icon: "shield" },
  { id: "wrap", key: "phTabWrap", icon: "check" },
];

function Screen({ tab, t }: { tab: Tab; t: T }) {
  if (tab === "intro") {
    return (
      <div className="lp-ph-screen lp-ph-intro">
        <span className="lp-ph-k">{t("phShow")}</span>
        <p lang="pl" className="lp-ph-big">Dzień dobry. Nie mówię dobrze po polsku. Ta aplikacja tłumaczy naszą rozmowę.</p>
        <p className="lp-ph-en">{t("phIntroLine")}</p>
        <span className="lp-ph-pill">{t("phStart")}</span>
      </div>
    );
  }
  if (tab === "table") {
    return (
      <div className="lp-ph-screen lp-ph-table">
        <div className="lp-ph-half lp-ph-flip">
          <span className="lp-ph-k" lang="pl">Urzędnik · po polsku</span>
          <p lang="pl">„Brakuje potwierdzenia ubezpieczenia zdrowotnego.”</p>
        </div>
        <span className="lp-ph-mid"><Icon name="flip" size={13} /></span>
        <div className="lp-ph-half">
          <span className="lp-ph-k">{t("phYou")}</span>
          <p>{t("phMissing")}</p>
          <div className="lp-ph-mics"><span><Icon name="mic" size={16} /></span><span className="is-you"><Icon name="mic" size={16} /></span></div>
        </div>
      </div>
    );
  }
  if (tab === "watch") {
    return (
      <div className="lp-ph-screen">
        <div className="lp-ph-bubble lp-ph-off" lang="pl">„Ma pan czternaście dni na odpowiedź.”</div>
        <div className="lp-ph-bubble lp-ph-me">{t("phFourteen")}</div>
        <div className="lp-ph-card">
          <span className="lp-ph-k"><span className="lp-dot-live" aria-hidden="true" />{t("watcher")}</span>
          <p>{t("watcherWarn")}</p>
          <p lang="pl" className="lp-ph-ask">„Czy chodzi o czternaście dni?”</p>
        </div>
      </div>
    );
  }
  return (
    <div className="lp-ph-screen">
      <div className="lp-ph-card">
        <span className="lp-ph-k">{t("wuHead")}</span>
        <p><b>{t("wuAgreed")}</b> {t("wuAgreedV")}</p>
        <p><b>{t("wuBring")}</b> {t("wuBringV")}</p>
        <p><b>{t("phDates")}</b> {t("phDatesV")}</p>
      </div>
      <span className="lp-ph-pill"><Icon name="calendar" size={13} /> {t("addCalendar")}</span>
    </div>
  );
}

/** "The phone that answers for you", Dossierly's way: table mode on a phone, with tabs for each moment. */
export function PhoneSection() {
  const t = useT("landing");
  const [tab, setTab] = useState<Tab>("table");
  return (
    <section className="lp-sec" aria-labelledby="phone-h">
      <div className="lp-wrap">
        <header className="lp-head-c">
          <svg className="lp-phone-ic" width="32" height="40" viewBox="0 0 32 40" fill="none" aria-hidden="true">
            <rect x="5" y="2" width="22" height="36" rx="6" stroke="currentColor" strokeWidth="2.4" />
            <path d="M13 7h6" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
          </svg>
          <h2 id="phone-h" className="lp-h2" data-sweep>{t("phTitle")}</h2>
          <p className="lp-body">{t("phBody")}</p>
          <div className="lp-hero-ctas">
            <Link className="lp-btn lp-btn-dark" href="/signup">{t("getStarted")}</Link>
          </div>
        </header>
        <div className="lp-ph-tabs" role="tablist" aria-label={t("phTabsAria")}>
          {TABS.map((x) => (
            <button key={x.id} type="button" role="tab" id={`ph-tab-${x.id}`} aria-selected={tab === x.id}
              aria-controls="ph-panel" className={`lp-tab${tab === x.id ? " is-active" : ""}`} onClick={() => setTab(x.id)}>
              <Icon name={x.icon} size={14} />{t(x.key)}
            </button>
          ))}
        </div>
        <div className="lp-ph-panel" data-reveal>
          <p className="lp-note lp-note-l"><span>{t("note")}</span>{t("phNoteFlip")}</p>
          <div className="lp-ph" id="ph-panel" role="tabpanel" aria-labelledby={`ph-tab-${tab}`}>
            <div className="lp-ph-bar" aria-hidden="true"><span>9:41</span><i /><span>●●●</span></div>
            <div key={tab} className="lp-ph-swap"><Screen tab={tab} t={t} /></div>
          </div>
          <p className="lp-note lp-note-r"><span>{t("note")}</span>{t("phNoteAudio")}</p>
          <div className="lp-ph-promo">
            <b>{t("phPromo")}</b>
            <span>{t("phPromoSub")}</span>
            <div>
              <Link className="lp-btn lp-btn-dark lp-btn-sm" href="/signup">{t("getStarted")}</Link>
              <Link className="lp-btn lp-btn-ghost lp-btn-sm" href="/limits">{t("knownLimits")}</Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
