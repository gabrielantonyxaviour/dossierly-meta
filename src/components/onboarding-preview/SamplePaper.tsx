import { useT } from "@/lib/i18n/client";
import { rich } from "@/lib/i18n/rich";
import { evidenceCopy, layoutReference, paperStories } from "./paper-content";
import type { Need } from "./content";
import type { Demo } from "./journey";

export function SamplePaper({ need, demo, highlight }: { need: Need; demo: Demo; highlight(evidence: Demo["evidence"]): void }) {
  const t = useT("tour");
  const paper = paperStories[need];
  const officialLayout = need === "letters";
  function evidence(kind: Demo["evidence"]) {
    return <button type="button" id={`source-${need}-${kind}`} className="op-paper-highlight"
      data-highlighted={demo.phase > 0 && demo.evidence === kind} aria-pressed={demo.phase > 0 && demo.evidence === kind}
      aria-label={t("explainAria", { label: evidenceCopy(need, kind, t).label.toLocaleLowerCase() })} onClick={() => highlight(kind)}>{paper[kind].text}</button>;
  }
  return <section className="op-document-pane" aria-label={t("docPaneAria")}>
    <div className="op-document-toolbar"><span className="op-badge">{t("badgeFictional")}</span><span>{t("toolbarCase")}</span></div>
    <div className="op-paper-stage">
      <article className="op-paper" aria-label={t("sourceAria")} lang="pl" data-paper-kind={need}>
        <div className="op-paper-top"><div className="op-paper-institution">
          <strong>{officialLayout ? "MAZOWIECKI URZĄD WOJEWÓDZKI\nW WARSZAWIE" : "TECZKA ARJUNA MEHTY"}</strong>
          <span>{officialLayout ? "Wydział Spraw Cudzoziemców · przykład" : "Materiały robocze · fikcyjny scenariusz"}</span>
          {officialLayout && <span>pl. Bankowy 3/5, 00-950 Warszawa</span>}
        </div><span className="op-paper-watermark">WZÓR / PRZYKŁAD</span></div>
        <p className="op-paper-date">Warszawa, 2 listopada 2026 r.</p>
        <p className="op-paper-reference">Znak sprawy: PRZYKŁAD/2026/0142</p>
        <div className="op-paper-recipient"><strong>Pan Arjun Mehta</strong><span>ul. Przykładowa 12/4</span><span>00-001 Warszawa</span><small>Dane i adres są fikcyjne</small></div>
        <h2>{paper.heading}</h2>
        <p className="op-paper-subject"><strong>Dotyczy:</strong> {paper.subject}</p>
        {officialLayout && <p className="op-paper-salutation">Szanowny Panie,</p>}
        <p>{paper.intro}</p>
        <p>{officialLayout ? <>Prosimy o przekazanie {evidence("request")} do dnia {evidence("detail")}</>
          : <><strong>Najważniejsza informacja:</strong> {evidence("request")}<br /><strong>Szczegół do sprawdzenia:</strong> {evidence("detail")}</>}</p>
        <p>Przygotowując odpowiedź, prosimy:</p>
        <ol>{paper.items.map((item) => <li key={item}>{item}</li>)}</ol>
        <p>{paper.closing}</p>
        <div className="op-paper-closing"><span>Z poważaniem</span><strong>Zespół przykładowej sprawy</strong><small>Tekst demonstracyjny — bez podpisu urzędowego</small></div>
        <div className="op-paper-attachments"><strong>Załączniki:</strong><p>1. {paper.attachment}</p></div>
        <footer>Materiał fikcyjny przygotowany do demonstracji Dossierly. Nie stanowi pisma urzędowego ani porady prawnej.<br />PRZYKŁAD/2026/0142 · Strona 1 z 1</footer>
      </article>
    </div>
    <p className="op-reference-note">{t("selectPassage")} {officialLayout && rich(t("layoutNote"), { link: <a href={layoutReference} target="_blank" rel="noreferrer">{t("layoutLink")}</a> })}</p>
  </section>;
}
