import { Icon } from "@/components/Icon";
import type { T } from "@/lib/i18n/translate";

/** Product cards for how it works: real HTML rendering Arjun's case. */

export function PrepareMock({ t }: { t: T }) {
  const items = [
    { t: t("pmPassport"), ok: true },
    { t: t("pmPhoto"), ok: true },
    { t: t("pmFee"), ok: true },
    { t: t("pmInsurance"), ok: false },
  ];
  return (
    <div className="lp-ui">
      <div className="lp-ui-head"><Icon name="prepare" size={15} /> {t("pmHead")} <span className="lp-ui-count">{t("pmCount")}</span></div>
      <div className="lp-ui-body">
        <ul className="lp-ui-list">
          {items.map((i) => (
            <li key={i.t} className={i.ok ? "is-ok" : "is-miss"}>
              <span className="lp-ui-tick" aria-hidden="true">{i.ok ? <Icon name="check" size={12} /> : "!"}</span>
              {i.t}<span className="sr-only">{i.ok ? t("pmInCase") : t("pmMissing")}</span>
            </li>
          ))}
        </ul>
        <div className="lp-ui-well">
          <p className="lp-ui-k">{t("pmChanged")}</p>
          <p>{t("pmChange")}</p>
        </div>
        <p className="lp-ui-cite"><Icon name="link" size={13} /> {t("pmCite")}</p>
      </div>
    </div>
  );
}

export function MeetMock({ t }: { t: T }) {
  return (
    <div className="lp-ui">
      <div className="lp-ui-head"><Icon name="meet" size={15} /> {t("mmHead")}</div>
      <div className="lp-ui-body">
        <div className="lp-ui-turn lp-ui-off">
          <span className="lp-ui-k">{t("mmOfficial")}</span>
          <p lang="pl">„Brakuje potwierdzenia ubezpieczenia zdrowotnego. Przyjdzie pismo.”</p>
        </div>
        <div className="lp-ui-turn lp-ui-you">
          <span className="lp-ui-k">{t("mmForYou")}</span>
          <p>{t("mmYouLine")}</p>
        </div>
        <div className="lp-ui-well lp-ui-watch">
          <p className="lp-ui-k"><span className="lp-dot-live" aria-hidden="true" />{t("watcher")}</p>
          <p>{t("watcherWarn")}</p>
          <p className="lp-ui-ask" lang="pl">„Czy chodzi o czternaście dni?”</p>
        </div>
      </div>
    </div>
  );
}

export function WrapUpMock({ t }: { t: T }) {
  const rows = [
    { k: t("wuAgreed"), v: t("wuAgreedV") },
    { k: t("wuBring"), v: t("wuBringV") },
    { k: t("wuDates"), v: t("wuDatesV") },
  ];
  return (
    <div className="lp-ui">
      <div className="lp-ui-head"><Icon name="check" size={15} /> {t("wuHead")}</div>
      <div className="lp-ui-body">
        <dl className="lp-ui-dl">
          {rows.map((r) => <div key={r.k}><dt>{r.k}</dt><dd>{r.v}</dd></div>)}
        </dl>
        <div className="lp-ui-btns" aria-hidden="true">
          <span className="lp-ui-btn lp-ui-btn-dark"><Icon name="calendar" size={14} /> {t("addCalendar")}</span>
          <span className="lp-ui-btn">{t("wuSaved")}</span>
        </div>
      </div>
    </div>
  );
}

export function LetterMock({ t }: { t: T }) {
  const steps = [t("lmStep1"), t("lmStep2"), t("lmStep3")];
  return (
    <div className="lp-ui">
      <div className="lp-ui-head"><Icon name="letter" size={15} /> {t("lmHead")}</div>
      <div className="lp-ui-body">
        <p className="lp-ui-verbatim" lang="pl">„…w terminie 14 dni od dnia doręczenia niniejszego wezwania…”</p>
        <p className="lp-ui-cite"><Icon name="link" size={13} /> {t("lmLinked")}</p>
        <div className="lp-ui-well">
          <p className="lp-ui-k lp-ui-red">{t("lmReplyBy")}</p>
          <p className="lp-ui-big">{t("lmDate")}</p>
          <ol className="lp-ui-steps">{steps.map((s) => <li key={s}>{s}</li>)}</ol>
        </div>
        <div className="lp-ui-btns" aria-hidden="true">
          <span className="lp-ui-btn lp-ui-btn-dark"><Icon name="file" size={14} /> {t("lmReview")}</span>
        </div>
      </div>
    </div>
  );
}
