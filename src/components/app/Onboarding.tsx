"use client";

import { useEffect, useRef, useState } from "react";
import { LANGUAGE_NAMES, OFFICES } from "@/lib/client/sample";
import { useCase } from "@/lib/client/store";
import type { Language } from "@/lib/client/types";
import { Select } from "../ui/Select";
import { useT } from "@/lib/i18n/client";

const OFFICE_OPTIONS = OFFICES.map((o) => ({ value: o, label: o.replace("Wydział Spraw Cudzoziemców MUW - ", "Mazowiecki · "), description: o.replace(" - ", " · ") }));

export function Onboarding() {
  const t = useT("onboarding");
  const { startSample, startOwn } = useCase();
  const [name, setName] = useState("");
  const [language, setLanguage] = useState<Language>("en");
  const [office, setOffice] = useState(OFFICES[0]);
  const [busy, setBusy] = useState(false);
  const auto = useRef(false);

  useEffect(() => {
    const p = new URLSearchParams(window.location.search).get("start");
    if (p === "sample" && !auto.current) {
      auto.current = true;
      void startSample();
    }
  }, [startSample]);

  const own = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    await startOwn(name.trim(), language, office);
  };

  return (
    <div className="onboard">
      <div className="stack" style={{ ["--gap" as string]: "8px" }}>
        <span className="tab-label">{t("legacyKicker")}</span>
        <h1 style={{ margin: 0 }}>{t("legacyTitle")}</h1>
        <p className="muted lead" style={{ margin: 0 }}>{t("legacyLead")}</p>
      </div>

      <section className="sample-photo" aria-labelledby="sample-h">
        <div className="sample-photo-img" aria-hidden="true" />
        <div className="sample-photo-body">
          <h2 id="sample-h">Arjun Raman</h2>
          <p>{t("legacySample")}</p>
          <button className="sample-photo-btn" onClick={() => void startSample()}>
            <span>{t("legacyExplore")}</span>
            <span className="sample-photo-arrow" aria-hidden="true">→</span>
          </button>
        </div>
      </section>

      <form className="card stack own-form" onSubmit={own} aria-labelledby="own-h">
        <h2 id="own-h" style={{ margin: 0 }}>{t("legacyOwn")}</h2>
        <label className="field">
          <span>{t("legacyName")}</span>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" required maxLength={80} placeholder={t("fullNamePlaceholder")} />
        </label>
        <fieldset className="field" style={{ border: 0, padding: 0, margin: 0 }}>
          <legend className="label" style={{ marginBottom: 6 }}>{t("legacyLanguage")}</legend>
          <div className="seg">
            {(Object.keys(LANGUAGE_NAMES) as Language[]).map((l) => (
              <label key={l}>
                <input type="radio" name="lang" value={l} checked={language === l} onChange={() => setLanguage(l)} />
                <span>{LANGUAGE_NAMES[l].native}</span>
              </label>
            ))}
          </div>
        </fieldset>
        <div className="field">
          <span id="office-label">{t("legacyOffice")}</span>
          <Select id="office" labelledBy="office-label" value={office} onChange={setOffice} options={OFFICE_OPTIONS} />
        </div>
        <p className="tiny muted" style={{ margin: 0 }}>{t("legacyScope")}</p>
        <button className="btn btn-block btn-primary" disabled={busy || !name.trim()}>{t("legacyCreate")}</button>
      </form>
    </div>
  );
}
