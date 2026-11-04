import coverage from "../../../hub/poland/coverage.json";
import sourcesFile from "../../../hub/poland/sources.json";

type Rule = { days: number | null; from: string | null; basis?: string; quote?: string; verified?: boolean };
type LetterType = { id: string; polishName: string; englishName: string; whatItMeans: string; deadlineRule: Rule };
type Office = { id: string; name: string; city: string; url: string; notes: string; verified: boolean };
type Fee = { id: string; amountPln: number; what: string; verified: boolean };
type Claim = { claim: string; whatYouTried: string };

const offices = coverage.offices as Office[];
const letters = coverage.letterTypes as unknown as LetterType[];
const fees = coverage.fees as unknown as Fee[];
const unverified = (coverage as unknown as { unverifiedClaims?: Claim[] }).unverifiedClaims ?? [];
const sources = sourcesFile.sources;

const Verified = ({ ok }: { ok: boolean }) => <span className={`chip ${ok ? "chip-ok" : "chip-warn"}`}>{ok ? "verified" : "not verified"}</span>;

export function PolandCoverage() {
  return (
    <div className="stack" style={{ ["--gap" as string]: "36px" }}>
      <section aria-labelledby="lt-h">
        <h2 id="lt-h">Letter types and their deadline rules</h2>
        <p className="muted">The number of days always comes from the sentence in your letter. These are the statutory rules behind them, quoted from the law.</p>
        <div className="cov-list">
          {letters.map((l) => (
            <article key={l.id} className="cov-item">
              <div className="row between">
                <h3 style={{ margin: 0 }} lang="pl">{l.polishName}</h3>
                <Verified ok={!!l.deadlineRule.verified} />
              </div>
              <p className="small muted" style={{ margin: "2px 0 8px" }}>{l.englishName}</p>
              <p className="small">{l.whatItMeans}</p>
              <p className="small" style={{ margin: 0 }}>
                <b className="mono">{l.deadlineRule.days !== null ? `${l.deadlineRule.days} days${l.deadlineRule.from ? ` from ${l.deadlineRule.from.replace("_", " ")}` : ""}` : "Date set in the letter"}</b>
                {l.deadlineRule.basis && <span className="muted"> · {l.deadlineRule.basis}</span>}
              </p>
              {l.deadlineRule.quote && <blockquote className="cov-quote" lang="pl">„{l.deadlineRule.quote}”</blockquote>}
            </article>
          ))}
        </div>
      </section>

      <section aria-labelledby="of-h">
        <h2 id="of-h">Offices</h2>
        <div className="cov-grid">
          {offices.map((o) => (
            <article key={o.id} className="cov-item">
              <h3 style={{ margin: "0 0 4px", fontSize: "1rem" }} lang="pl">{o.name.replace("Wydział Spraw Cudzoziemców MUW - ", "")}</h3>
              <p className="small muted" style={{ margin: "0 0 6px" }}>{o.notes}</p>
              <a className="tiny" href={o.url} target="_blank" rel="noreferrer">{new URL(o.url).hostname}</a>
            </article>
          ))}
        </div>
      </section>

      <section aria-labelledby="fee-h">
        <h2 id="fee-h">Fees</h2>
        <div className="table-scroll">
          <table className="runs-table cov-table">
            <tbody>
              {fees.map((f) => (
                <tr key={f.id}>
                  <td className="num" style={{ fontWeight: 700 }}>{f.amountPln} zł</td>
                  <td style={{ whiteSpace: "normal" }}>{f.what}</td>
                  <td><Verified ok={f.verified} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section aria-labelledby="src-h">
        <h2 id="src-h">Official sources</h2>
        <p className="muted">{sources.length} official sources read at the source.</p>
        <ul className="src-list">
          {sources.map((s) => (
            <li key={s.id}>
              <a href={s.url} target="_blank" rel="noreferrer" lang="pl">{s.title}</a>
              <span className="row" style={{ gap: 6 }}>
                <span className="tiny muted mono">{s.kind}</span>
                {!s.verified && <span className="chip chip-warn">not verified</span>}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="lang-h">
        <h2 id="lang-h">Languages</h2>
        <p>Polish with English, Ukrainian (українська), Hindi (हिन्दी) and Tamil (தமிழ்).</p>
      </section>

      {unverified.length > 0 && (
        <section aria-labelledby="uv-h">
          <h2 id="uv-h">What we could not verify</h2>
          <p className="muted">Published so you know where the coverage ends.</p>
          <ul className="cov-list small">
            {unverified.map((u) => <li key={u.claim} className="cov-item"><b>{u.claim}</b><p className="muted" style={{ margin: "4px 0 0" }}>{u.whatYouTried}</p></li>)}
          </ul>
        </section>
      )}
      <p className="small muted">{coverage.disclaimer}</p>
    </div>
  );
}
