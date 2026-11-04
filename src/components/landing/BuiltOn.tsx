/* eslint-disable @next/next/no-img-element -- static SVG logos, no optimisation needed */

const MODELS: { name: string; role: string }[] = [
  { name: "Muse Spark", role: "Your agent: answers, reads letters, drafts replies, guards every turn" },
  { name: "SAM 3.1", role: "Outlines what it reads in your photos" },
  { name: "Muse Voice Transcribe", role: "Turns your speech and the official’s into text" },
  { name: "Muse Wonder", role: "Reviews your whole case every night" },
];

/** "And it's all one system": official logos, each cell with what that part does in the product. */
export function BuiltOn() {
  return (
    <section className="lp-sec" aria-labelledby="built-h">
      <div className="lp-wrap">
        <header className="lp-head-l">
          <h2 id="built-h" className="lp-h2" data-sweep>And it&apos;s all one system</h2>
          <p className="lp-body">
            Meta&apos;s Muse models, each in the job it fits, running on Cloudflare inside one private agent per person.
          </p>
        </header>
        <ul className="lp-sys">
          <li className="lp-sys-cell lp-sys-meta">
            <div className="lp-sys-top">
              <img src="/logos/meta.svg" alt="Meta" width={119} height={24} />
              <span className="lp-sys-role">Every model</span>
            </div>
            <ul className="lp-sys-models">
              {MODELS.map((m) => (
                <li key={m.name}><b>{m.name}</b><span>{m.role}</span></li>
              ))}
            </ul>
          </li>
          <li className="lp-sys-cell">
            <div className="lp-sys-top">
              <img src="/logos/cloudflare.svg" alt="Cloudflare" width={96} height={34} />
              <span className="lp-sys-role">Hosting and your case file</span>
            </div>
            <ul className="lp-sys-models">
              <li><b>Workers</b><span>Runs the app and your agent</span></li>
              <li><b>Durable Objects</b><span>One private case file per person</span></li>
              <li><b>D1</b><span>Your account and sign-in</span></li>
            </ul>
          </li>
        </ul>
      </div>
    </section>
  );
}
