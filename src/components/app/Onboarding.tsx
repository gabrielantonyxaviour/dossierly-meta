"use client";

import { useEffect, useRef, useState } from "react";
import { LANGUAGE_NAMES, OFFICES } from "@/lib/client/sample";
import { useCase } from "@/lib/client/store";
import type { Language } from "@/lib/client/types";
import { Select } from "../ui/Select";

const OFFICE_OPTIONS = OFFICES.map((o) => ({ value: o, label: o.replace("Wydział Spraw Cudzoziemców MUW - ", "Mazowiecki · "), description: o.replace(" - ", " · ") }));

export function Onboarding() {
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
        <span className="tab-label">New case · Poland</span>
        <h1 style={{ margin: 0 }}>Let&apos;s open your case file</h1>
        <p className="muted lead" style={{ margin: 0 }}>Your case lives on this device, encrypted. Your agent works from a masked copy so it can remember.</p>
      </div>

      <section className="sample-photo" aria-labelledby="sample-h">
        <div className="sample-photo-img" aria-hidden="true" />
        <div className="sample-photo-body">
          <h2 id="sample-h">Arjun Raman</h2>
          <p>Temporary residence and work · Mazowiecki office, Warsaw · fingerprints taken on 18 Sep, a letter is on its way.</p>
          <button className="sample-photo-btn" onClick={() => void startSample()}>
            <span>Explore the sample case</span>
            <span className="sample-photo-arrow" aria-hidden="true">→</span>
          </button>
        </div>
      </section>

      <form className="card stack own-form" onSubmit={own} aria-labelledby="own-h">
        <h2 id="own-h" style={{ margin: 0 }}>Or start my own case</h2>
        <label className="field">
          <span>Your name</span>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" required maxLength={80} placeholder="As written in your passport" />
        </label>
        <fieldset className="field" style={{ border: 0, padding: 0, margin: 0 }}>
          <legend className="label" style={{ marginBottom: 6 }}>Your language</legend>
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
          <span id="office-label">Your office</span>
          <Select id="office" labelledBy="office-label" value={office} onChange={setOffice} options={OFFICE_OPTIONS} />
        </div>
        <p className="tiny muted" style={{ margin: 0 }}>Poland only for now: temporary residence and work in the Mazowieckie voivodeship. Germany and France are next.</p>
        <button className="btn btn-block btn-primary" disabled={busy || !name.trim()}>Create my case</button>
      </form>
    </div>
  );
}
