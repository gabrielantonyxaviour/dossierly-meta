import Link from "next/link";
import { Icon } from "@/components/Icon";

const LEDGER = [
  { t: "Super VL · letter reading", s: "store: false · 7:13 PM" },
  { t: "migrant.wsc.mazowieckie.pl", s: "allowed by policy · 7:12 PM" },
  { t: "an unknown host", s: "denied by policy · 7:12 PM" },
];

/** Privacy, Beside's "It asks first" pattern: three bordered cards, each with a small proof inside. */
export function Privacy() {
  return (
    <section className="lp-sec" aria-labelledby="privacy-h">
      <div className="lp-wrap">
        <header className="lp-head-l">
          <h2 id="privacy-h" className="lp-h2"><span data-sweep>Private by design</span><span className="lp-h2-muted">and you can check it</span></h2>
        </header>
        <div className="lp-trio">
          <article className="lp-trio-card" data-reveal>
            <h3>Its own private agent</h3>
            <p>Every person gets their own agent that only reads official Polish sources and your own case.</p>
            <div className="lp-trio-well">
              <div className="lp-ui">
                <div className="lp-ui-head"><Icon name="shield" size={15} /> Sources · restricted</div>
                <div className="lp-ui-body">
                  <ul className="lp-ui-list">
                    <li className="is-ok"><span className="lp-ui-tick" aria-hidden="true"><Icon name="check" size={12} /></span>Official Polish sites</li>
                    <li className="is-ok"><span className="lp-ui-tick" aria-hidden="true"><Icon name="check" size={12} /></span>The app</li>
                    <li className="is-miss"><span className="lp-ui-tick" aria-hidden="true">×</span>Everything else is denied</li>
                  </ul>
                </div>
              </div>
            </div>
          </article>
          <article className="lp-trio-card" data-reveal>
            <h3>Masked before any model call</h3>
            <p>PESEL, passport and case numbers, names and addresses are replaced before a model sees them, then restored in the answer.</p>
            <div className="lp-trio-well">
              <div className="lp-ui">
                <div className="lp-ui-head"><Icon name="lock" size={15} /> What the model sees</div>
                <div className="lp-ui-body">
                  <p className="lp-mask">Applicant <mark>[NAME_1]</mark>, passport <mark>[PASSPORT_1]</mark>, case <mark>[CASE_1]</mark>, asks about the wezwanie of 27 Oct.</p>
                  <div className="lp-ui-btns" aria-hidden="true">
                    <span className="lp-ui-btn lp-ui-btn-dark"><Icon name="lock" size={13} /> Encrypted on this device</span>
                  </div>
                </div>
              </div>
            </div>
          </article>
          <article className="lp-trio-card" data-reveal>
            <h3>A ledger you can read</h3>
            <p>Every model call and every connection your agent made, recorded in a ledger you can read.</p>
            <div className="lp-trio-well">
              <div className="lp-ui">
                <div className="lp-ui-head"><Icon name="file" size={15} /> Privacy ledger · today</div>
                <div className="lp-ui-body">
                  <ul className="lp-ledger">
                    {LEDGER.map((l) => (
                      <li key={l.t}><b>{l.t}</b><span>{l.s}</span></li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </article>
        </div>
        <p className="lp-fine">
          Your case lives on your device, encrypted with AES-GCM. What we
          cannot promise yet is on <Link href="/limits" className="lp-ulink">the limits page</Link>.
        </p>
      </div>
    </section>
  );
}
