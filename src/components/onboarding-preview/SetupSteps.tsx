import { Select } from "@/components/ui/Select";
import { Checkbox } from "@/components/ui/Checkbox";
import { useT } from "@/lib/i18n/client";
import { languageOptions, needDescription, needLabel, needs, officeRelevant, reasonLabel, reasons, stageLabel, stages, type Answers, type Need } from "./content";

type Props = { answers: Answers; update(patch: Partial<Answers>): void; error: string };

export function DetailsStep({ answers, update, error }: Props) {
  const t = useT("tour");
  return <div className="op-fields">
    <label className="field" data-invalid={!!error}>
      <span>{t("fullName")}</span>
      <input className="input" id="preview-name" autoComplete="off" value={answers.name} maxLength={100}
        onChange={(event) => update({ name: event.target.value })} aria-invalid={!!error}
        aria-describedby={error ? "op-error" : "name-help"} placeholder={t("namePlaceholder")} />
      <small id="name-help" className="op-help">{t("nameHelp")}</small>
    </label>
    <div className="field">
      <span className="label" id="country-label">{t("settlingLabel")}</span>
      <Select value="pl" onChange={() => {}} options={[{ value: "pl", label: t("poland") }]} labelledBy="country-label" disabled />
      <small className="op-help">{t("moreCountries")}</small>
    </div>
    <div className="field">
      <span className="label" id="language-label">{t("firstLanguage")}</span>
      <Select value={answers.language} onChange={(language) => update({ language })} options={languageOptions(t)} labelledBy="language-label" />
      <small className="op-help">{t("firstLanguageHelp")}</small>
    </div>
  </div>;
}

export function SituationStep({ answers, update, error }: Props) {
  const t = useT("tour");
  return <div className="op-fields">
    <fieldset className="op-fieldset" aria-describedby={error ? "op-error" : undefined}>
      <legend>{t("reasonLegend")}</legend>
      <div className="op-reasons">
        {reasons.map((reason) => <label className="op-radio" key={reason}>
          <input type="radio" name="reason" value={reason} checked={answers.reason === reason}
            onChange={() => update({ reason })} />
          <span>{reasonLabel(reason, t)}</span>
        </label>)}
      </div>
    </fieldset>
    <div className="field">
      <span className="label" id="stage-label">{t("stageLabel")}</span>
      <Select id="preview-stage" value={answers.stage} onChange={(stage) => update({ stage })}
        options={stages.map((stage) => ({ value: stage, label: stageLabel(stage, t) }))} labelledBy="stage-label" placeholder={t("stagePlaceholder")} />
    </div>
    <label className="field">
      <span>{t("cityLabel")} <span className="op-optional">{t("optional")}</span></span>
      <input className="input" value={answers.city} autoComplete="off" maxLength={100} placeholder={t("cityPlaceholder")}
        onChange={(event) => update({ city: event.target.value })} />
      <small className="op-help">{t("cityHelp")}</small>
    </label>
    {officeRelevant(answers.stage) && <label className="field">
      <span>{t("officeLabel")} <span className="op-optional">{t("optional")}</span></span>
      <input className="input" value={answers.office} autoComplete="off" maxLength={160} placeholder={t("officePlaceholder")}
        onChange={(event) => update({ office: event.target.value })} />
    </label>}
  </div>;
}

export function PrioritiesStep({ answers, update, error }: Props) {
  const t = useT("tour");
  function toggle(need: Need, selected: boolean) {
    const next = selected ? [...answers.needs, need] : answers.needs.filter((item) => item !== need);
    update({ needs: next, main: next.includes(answers.main as Need) ? answers.main : next[0] ?? "" });
  }
  return <div className="op-fields">
    <fieldset className="op-fieldset" aria-describedby={error ? "op-error" : "needs-help"}>
      <legend>{t("helpLegend")}</legend>
      <p className="op-help" id="needs-help">{t("helpHint")}</p>
      <div className="op-needs">
        {needs.map((need) => <Checkbox key={need.value} className="op-choice" checked={answers.needs.includes(need.value)}
          onChange={(selected) => toggle(need.value, selected)}>
          <span className="op-choice-title">{needLabel(need.value, t)}</span><span className="op-help">{needDescription(need.value, t)}</span>
        </Checkbox>)}
      </div>
    </fieldset>
    {answers.needs.length ? <div className="field op-main-priority">
      <span className="label" id="priority-label">{t("mainLabel")}</span>
      <Select value={answers.main} onChange={(main) => update({ main: main as Need })}
        options={answers.needs.map((need) => ({ value: need, label: needLabel(need, t) }))}
        labelledBy="priority-label" />
      <small className="op-help">{t("mainHelp")}</small>
    </div> : <p className="op-empty">{t("needsEmpty")}</p>}
  </div>;
}
