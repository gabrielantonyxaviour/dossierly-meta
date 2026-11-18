"use client";

import Link from "next/link";
import { useT } from "@/lib/i18n/client";
import { Icon, type IconName } from "../../Icon";

const STEPS: { icon: IconName; key: string; href: string }[] = [
  { icon: "prepare", key: "prepare", href: "/app/prepare" },
  { icon: "meet", key: "meet", href: "/app/meet" },
  { icon: "calendar", key: "wrap", href: "/app/meet" },
  { icon: "letter", key: "letters", href: "/app/letters" },
];

const FAQ = ["1", "2", "3", "4"];

export function HelpPage() {
  const t = useT("help");

  return (
    <div className="page page-wide help">
      <span className="tab-label">{t("kicker")}</span>
      <h1 className="page-title">{t("title")}</h1>
      <p className="muted lead">{t("lead")}</p>

      <div className="help-steps">
        {STEPS.map((s) => (
          <Link key={s.key} href={s.href} className="help-step">
            <span className="help-ic"><Icon name={s.icon} size={20} /></span>
            <b>{t(`${s.key}Title`)}</b>
            <span>{t(`${s.key}Body`)}</span>
          </Link>
        ))}
      </div>

      <div className="help-grid">
        <section className="card help-card" aria-labelledby="agent-h">
          <span className="tab-label">{t("agentKicker")}</span>
          <h2 id="agent-h" className="h-card">{t("agentTitle")}</h2>
          <p className="muted small">{t("agentBody")}</p>
          <Link className="btn btn-small" href="/app/privacy">{t("agentLink")}</Link>
        </section>

        <section className="card help-card" aria-labelledby="guard-h">
          <span className="tab-label">{t("guardKicker")}</span>
          <h2 id="guard-h" className="h-card">{t("guardTitle")}</h2>
          <p className="muted small">{t("guardBody")}</p>
          <p className="muted small" style={{ margin: 0 }}>{t("guardLawyer")}</p>
        </section>
      </div>

      <section className="help-faq" aria-labelledby="faq-h">
        <h2 id="faq-h">{t("faqTitle")}</h2>
        {FAQ.map((n) => (
          <details key={n} className="faq-item">
            <summary>{t(`q${n}`)}</summary>
            <p>{t(`a${n}`)}</p>
          </details>
        ))}
      </section>
      <p className="small muted">
        <Link href="/limits">{t("limits")}</Link> · <Link href="/legal/terms">{t("terms")}</Link> · <Link href="/legal/privacy">{t("privacyNotice")}</Link>
      </p>
    </div>
  );
}
