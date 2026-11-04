import { Icon } from "@/components/Icon";

/** Product cards for how it works. Real HTML, sample data from Arjun's fictional case. */

export function PrepareMock() {
  const items = [
    { t: "Passport, all pages", ok: true },
    { t: "Photo 35×45 mm", ok: true },
    { t: "Card fee receipt, 100 zł", ok: true },
    { t: "Proof of health insurance for the whole stay", ok: false },
  ];
  return (
    <div className="lp-ui">
      <div className="lp-ui-head"><Icon name="prepare" size={15} /> Next visit · Marszałkowska 3/5 <span className="lp-ui-count">3 of 4</span></div>
      <div className="lp-ui-body">
        <ul className="lp-ui-list">
          {items.map((i) => (
            <li key={i.t} className={i.ok ? "is-ok" : "is-miss"}>
              <span className="lp-ui-tick" aria-hidden="true">{i.ok ? <Icon name="check" size={12} /> : "!"}</span>
              {i.t}<span className="sr-only">{i.ok ? ", already in your case" : ", missing"}</span>
            </li>
          ))}
        </ul>
        <div className="lp-ui-well">
          <p className="lp-ui-k">Changed since you last prepared</p>
          <p>19 Oct 2026: a certificate now replaces the passport stamp.</p>
        </div>
        <p className="lp-ui-cite"><Icon name="link" size={13} /> Each line cites its paragraph on migrant.wsc.mazowieckie.pl</p>
      </div>
    </div>
  );
}

export function MeetMock() {
  return (
    <div className="lp-ui">
      <div className="lp-ui-head"><Icon name="meet" size={15} /> Table mode · live</div>
      <div className="lp-ui-body">
        <div className="lp-ui-turn lp-ui-off">
          <span className="lp-ui-k">Official · Polish</span>
          <p lang="pl">„Brakuje potwierdzenia ubezpieczenia zdrowotnego. Przyjdzie pismo.”</p>
        </div>
        <div className="lp-ui-turn lp-ui-you">
          <span className="lp-ui-k">For you · English</span>
          <p>Proof of health insurance is missing. A letter will follow.</p>
        </div>
        <div className="lp-ui-well lp-ui-watch">
          <p className="lp-ui-k"><span className="lp-dot-live" aria-hidden="true" />Watcher</p>
          <p>A number of days could be misheard. Ask before you leave:</p>
          <p className="lp-ui-ask" lang="pl">„Czy chodzi o czternaście dni?”</p>
        </div>
      </div>
    </div>
  );
}

export function WrapUpMock() {
  const rows = [
    { k: "Agreed", v: "Fingerprints taken. Passport, photo and fee receipts accepted." },
    { k: "To bring", v: "Proof of health insurance for the whole stay." },
    { k: "Dates named", v: "None yet. A letter will follow by e-Doręczenia or post." },
  ];
  return (
    <div className="lp-ui">
      <div className="lp-ui-head"><Icon name="check" size={15} /> Wrap-up · Fri 18 Sep</div>
      <div className="lp-ui-body">
        <dl className="lp-ui-dl">
          {rows.map((r) => <div key={r.k}><dt>{r.k}</dt><dd>{r.v}</dd></div>)}
        </dl>
        <div className="lp-ui-btns" aria-hidden="true">
          <span className="lp-ui-btn lp-ui-btn-dark"><Icon name="calendar" size={14} /> Add to calendar</span>
          <span className="lp-ui-btn">Saved to your case</span>
        </div>
      </div>
    </div>
  );
}

export function LetterMock() {
  const steps = [
    "Delivered Tue 27 Oct. The day of delivery is not counted.",
    "Day 1 is Wed 28 Oct.",
    "Day 14 is Tue 10 Nov, a working day.",
  ];
  return (
    <div className="lp-ui">
      <div className="lp-ui-head"><Icon name="letter" size={15} /> Letter · wezwanie</div>
      <div className="lp-ui-body">
        <p className="lp-ui-verbatim" lang="pl">„…w terminie 14 dni od dnia doręczenia niniejszego wezwania…”</p>
        <p className="lp-ui-cite"><Icon name="link" size={13} /> Linked to 18 Sep: the official said this letter would come.</p>
        <div className="lp-ui-well">
          <p className="lp-ui-k lp-ui-red">Reply by</p>
          <p className="lp-ui-big">Tuesday 10 November 2026</p>
          <ol className="lp-ui-steps">{steps.map((s) => <li key={s}>{s}</li>)}</ol>
        </div>
        <div className="lp-ui-btns" aria-hidden="true">
          <span className="lp-ui-btn lp-ui-btn-dark"><Icon name="file" size={14} /> Review the Polish draft</span>
        </div>
      </div>
    </div>
  );
}
