"use client";

import { Button } from "@/components/ui";
import type { DocCard } from "@/lib/voice/protocol";

const LABEL_PL: Record<string, string> = {
  number: "Numer", nationality: "Obywatelstwo", valid_until: "Ważny do", address: "Adres", from: "Od", until: "Do", rent: "Czynsz",
  insurer: "Ubezpieczyciel", programme: "Kierunek", issued: "Wydano", received: "Doręczono", asks: "Wezwanie dotyczy", deadline_days: "Termin (dni)",
};
const pretty = (k: string) => LABEL_PL[k] ?? k.replace(/_/g, " ");

/** The document the official asked for, full screen and turned toward them. */
export function DocSheet({ doc, flat, onClose }: { doc: DocCard; flat: boolean; onClose: () => void }) {
  const fields = Object.entries(doc.fields).slice(0, 6);
  return (
    <div className="ct-doc" role="dialog" aria-modal="true" aria-label={`Showing ${doc.title} to the official`}>
      <div className={`ct-doc-card ${flat ? "is-flipped" : ""}`} lang="pl">
        <small>Dokument z mojej sprawy</small>
        <h2>{doc.captionPl}</h2>
        <p className="ct-doc-title">{doc.title}</p>
        {fields.length > 0 && (
          <dl>
            {fields.map(([k, v]) => (
              <div key={k}><dt>{pretty(k)}</dt><dd>{v}</dd></div>
            ))}
          </dl>
        )}
        <p className="ct-doc-note">Kopia z aplikacji Dossierly. Oryginał mam przy sobie.</p>
      </div>
      <div className="ct-doc-user">
        <p>Showing <b>{doc.title}</b> to the official, because they asked for it.</p>
        <Button variant="primary" onClick={onClose} autoFocus>Done</Button>
      </div>
    </div>
  );
}
