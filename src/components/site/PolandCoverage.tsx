import { getT } from "@/lib/i18n/server";
import { translator, type T } from "@/lib/i18n/translate";
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

/* The English catalogue repeats each dataset string, so a translation is used only while it still matches the data. */
const en = translator("en", "site");

/** Translated text for one coverage record, or the dataset's own English when its translation is missing or stale. */
const data = (t: T, key: string, english: string) => (en(key) === english ? t(key) : english);

const Verified = ({ ok, t }: { ok: boolean; t: T }) => <span className={`chip ${ok ? "chip-ok" : "chip-warn"}`}>{ok ? t("verified") : t("notVerified")}</span>;

function ruleText(t: T, r: Rule): string {
  if (r.days === null) return t("ruleDateInLetter");
  if (!r.from) return t("ruleDays", { n: r.days });
  return t("ruleDaysFrom", { n: r.days, from: data(t, `from_${r.from}`, r.from.replace("_", " ")) });
}

export async function PolandCoverage() {
  const t = await getT("site");
  return (
    <div className="stack" style={{ ["--gap" as string]: "36px" }}>
      <section aria-labelledby="lt-h">
        <h2 id="lt-h">{t("covLettersTitle")}</h2>
        <p className="muted">{t("covLettersLead")}</p>
        <div className="cov-list">
          {letters.map((l) => (
            <article key={l.id} className="cov-item">
              <div className="row between">
                <h3 style={{ margin: 0 }} lang="pl">{l.polishName}</h3>
                <Verified ok={!!l.deadlineRule.verified} t={t} />
              </div>
              <p className="small muted" style={{ margin: "2px 0 8px" }}>{data(t, `lt_${l.id}_name`, l.englishName)}</p>
              <p className="small">{data(t, `lt_${l.id}_means`, l.whatItMeans)}</p>
              <p className="small" style={{ margin: 0 }}>
                <b className="mono">{ruleText(t, l.deadlineRule)}</b>
                {l.deadlineRule.basis && <span className="muted"> · {data(t, `lt_${l.id}_basis`, l.deadlineRule.basis)}</span>}
              </p>
              {l.deadlineRule.quote && <blockquote className="cov-quote" lang="pl">„{l.deadlineRule.quote}”</blockquote>}
            </article>
          ))}
        </div>
      </section>

      <section aria-labelledby="of-h">
        <h2 id="of-h">{t("statOffices")}</h2>
        <div className="cov-grid">
          {offices.map((o) => (
            <article key={o.id} className="cov-item">
              <h3 style={{ margin: "0 0 4px", fontSize: "1rem" }} lang="pl">{o.name.replace("Wydział Spraw Cudzoziemców MUW - ", "")}</h3>
              <p className="small muted" style={{ margin: "0 0 6px" }}>{data(t, `office_${o.id}`, o.notes)}</p>
              <a className="tiny" href={o.url} target="_blank" rel="noreferrer">{new URL(o.url).hostname}</a>
            </article>
          ))}
        </div>
      </section>

      <section aria-labelledby="fee-h">
        <h2 id="fee-h">{t("covFees")}</h2>
        <div className="table-scroll">
          <table className="runs-table cov-table">
            <tbody>
              {fees.map((f) => (
                <tr key={f.id}>
                  <td className="num" style={{ fontWeight: 700 }}>{f.amountPln} zł</td>
                  <td style={{ whiteSpace: "normal" }}>{data(t, `fee_${f.id}`, f.what)}</td>
                  <td><Verified ok={f.verified} t={t} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section aria-labelledby="src-h">
        <h2 id="src-h">{t("covSources")}</h2>
        <p className="muted">{t("covSourcesLead", { n: sources.length })}</p>
        <ul className="src-list">
          {sources.map((s) => (
            <li key={s.id}>
              <a href={s.url} target="_blank" rel="noreferrer" lang="pl">{s.title}</a>
              <span className="row" style={{ gap: 6 }}>
                <span className="tiny muted mono">{data(t, `kind_${s.kind}`, s.kind)}</span>
                {!s.verified && <span className="chip chip-warn">{t("notVerified")}</span>}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="lang-h">
        <h2 id="lang-h">{t("statLanguages")}</h2>
        <p>{t("covLanguages")}</p>
      </section>

      {unverified.length > 0 && (
        <section aria-labelledby="uv-h">
          <h2 id="uv-h">{t("covUnverified")}</h2>
          <p className="muted">{t("covUnverifiedLead")}</p>
          <ul className="cov-list small">
            {unverified.map((u, i) => (
              <li key={u.claim} className="cov-item">
                <b>{data(t, `uv${i + 1}_claim`, u.claim)}</b>
                <p className="muted" style={{ margin: "4px 0 0" }}>{data(t, `uv${i + 1}_tried`, u.whatYouTried)}</p>
              </li>
            ))}
          </ul>
        </section>
      )}
      <p className="small muted">{data(t, "covDisclaimer", coverage.disclaimer)}</p>
    </div>
  );
}
