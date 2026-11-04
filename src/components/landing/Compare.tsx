const ROWS = [
  { k: "Your case", us: "Remembered from the first visit to the last letter", them: "Forgotten after each sentence" },
  { k: "At the counter", us: "Both ways, with a watcher for dates and amounts", them: "One sentence at a time" },
  { k: "Letters", us: "Read, linked to what was said, reply drafted", them: "Translated, then you are on your own" },
  { k: "Deadlines", us: "Counted in code, every step shown", them: "Not counted" },
  { k: "Sources", us: "Each line cites the official paragraph", them: "None" },
];

function Yes() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true" className="lp-cmp-ic">
      <circle cx="8" cy="8" r="6.6" stroke="currentColor" strokeWidth="1.3" />
      <path d="M5.3 8.2l1.8 1.8 3.6-3.7" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function No() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true" className="lp-cmp-ic lp-cmp-no">
      <circle cx="8" cy="8" r="6.6" stroke="currentColor" strokeWidth="1.3" />
      <path d="M6 6l4 4M10 6l-4 4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

/** Why Dossierly: copy on the left, a quiet comparison table on the right. */
export function Compare() {
  return (
    <section className="lp-sec lp-sec-lg" aria-labelledby="why-h">
      <div className="lp-wrap lp-why">
        <div>
          <p className="lp-eyebrow">Why Dossierly</p>
          <h2 id="why-h" className="lp-h2" data-sweep>Translation apps give you words. Dossierly carries the case.</h2>
          <p className="lp-body">
            Translation apps work one sentence at a time and forget everything. Agencies remember the case but cost
            thousands of złoty. Dossierly remembers the whole case, for a fraction of that.
          </p>
        </div>
        <div className="lp-cmp" data-reveal>
          <table>
            <caption className="sr-only">Dossierly compared with translation apps</caption>
            <thead>
              <tr><td /><th scope="col">Dossierly</th><th scope="col" className="lp-cmp-them">Translation apps</th></tr>
            </thead>
            <tbody>
              {ROWS.map((r) => (
                <tr key={r.k}>
                  <th scope="row">{r.k}</th>
                  <td><span><Yes />{r.us}</span></td>
                  <td className="lp-cmp-them"><span><No />{r.them}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
