/* eslint-disable @next/next/no-img-element -- static SVG logos, no optimisation needed */
import { getT } from "@/lib/i18n/server";

const MODELS: { name: string; role: string }[] = [
  { name: "Claude Sonnet", role: "boSpark" },
  { name: "Claude Haiku", role: "boSam" },
  { name: "Claude Sonnet", role: "boWonder" },
];
const VOICE: { name: string; role: string }[] = [
  { name: "Scribe", role: "boVoice" },
  { name: "Eleven v4", role: "boSpeak" },
];

/** "And it's all one system": official logos, each cell with what that part does in the product. */
export async function BuiltOn() {
  const t = await getT("landing");
  return (
    <section className="lp-sec" aria-labelledby="built-h">
      <div className="lp-wrap">
        <header className="lp-head-l">
          <h2 id="built-h" className="lp-h2" data-sweep>{t("boTitle")}</h2>
          <p className="lp-body">{t("boBody")}</p>
        </header>
        <ul className="lp-sys">
          <li className="lp-sys-cell lp-sys-meta">
            <div className="lp-sys-top">
              <b className="lp-sys-word">Anthropic</b>
              <span className="lp-sys-role">{t("boEvery")}</span>
            </div>
            <ul className="lp-sys-models">
              {MODELS.map((m) => (
                <li key={m.role}><b>{m.name}</b><span>{t(m.role)}</span></li>
              ))}
            </ul>
          </li>
          <li className="lp-sys-cell">
            <div className="lp-sys-top">
              <b className="lp-sys-word">ElevenLabs</b>
              <span className="lp-sys-role">{t("boVoiceRole")}</span>
            </div>
            <ul className="lp-sys-models">
              {VOICE.map((m) => (
                <li key={m.role}><b>{m.name}</b><span>{t(m.role)}</span></li>
              ))}
            </ul>
          </li>
          <li className="lp-sys-cell">
            <div className="lp-sys-top">
              <img src="/logos/cloudflare.svg" alt="Cloudflare" width={96} height={34} />
              <span className="lp-sys-role">{t("boHosting")}</span>
            </div>
            <ul className="lp-sys-models">
              <li><b>Workers</b><span>{t("boWorkers")}</span></li>
              <li><b>Durable Objects</b><span>{t("boDo")}</span></li>
              <li><b>D1</b><span>{t("boD1")}</span></li>
            </ul>
          </li>
        </ul>
      </div>
    </section>
  );
}
