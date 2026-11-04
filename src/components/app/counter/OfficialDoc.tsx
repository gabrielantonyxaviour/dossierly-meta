"use client";

import type { DocCard } from "@/lib/voice/protocol";
import { Icon } from "@/components/Icon";

const LABEL_PL: Record<string, string> = {
  newAddress: "Nowy adres", movedOn: "Od dnia", address: "Adres", startDate: "Od dnia", oldAddress: "Adres we wniosku", applicationAddress: "Adres we wniosku",
  caseNumber: "Znak sprawy", until: "Do", rent: "Czynsz", holder: "Posiadacz", number: "Numer", nationality: "Obywatelstwo",
  expires: "Ważny do", valid_until: "Ważny do", insurer: "Ubezpieczyciel", cover: "Okres", university: "Uczelnia", programme: "Kierunek",
  filedAt: "Złożono", dated: "Data pisma", delivered: "Doręczono", received: "Doręczono", sender: "Nadawca", issued: "Wydano",
};
const MONTHS = ["stycznia", "lutego", "marca", "kwietnia", "maja", "czerwca", "lipca", "sierpnia", "września", "października", "listopada", "grudnia"];
const VALUE_PL: Record<string, string> = { "Whole stay": "Cały okres pobytu" };
const value = (v: string) => (/^\d{4}-\d{2}-\d{2}$/.test(v) ? `${Number(v.slice(8))} ${MONTHS[Number(v.slice(5, 7)) - 1]} ${v.slice(0, 4)}` : VALUE_PL[v] ?? v);

/** The document the official asked for (or the notice Dossierly drafted), on the official's half, in Polish. */
export function OfficialDoc({ doc, onClose }: { doc: DocCard; onClose: () => void }) {
  const drafted = doc.kind === "address_change";
  // Label order is priority order: the facts the official checks first, few enough to read across the desk.
  const order = Object.keys(LABEL_PL);
  const fields = Object.entries(doc.fields)
    .filter(([k, v]) => LABEL_PL[k] && v && !(drafted && k === "caseNumber"))
    .sort(([a], [b]) => order.indexOf(a) - order.indexOf(b))
    .slice(0, drafted ? 2 : 3);
  return (
    <article className={`ct-odoc ${drafted ? "is-draft" : ""}`} aria-label={`Showing ${doc.title} to the official`}>
      <header>
        <small>{drafted ? "Projekt pisma · do złożenia dziś" : "Dokument z mojej sprawy"}</small>
        <button type="button" className="ct-odoc-x" onClick={onClose} aria-label="Hide document"><Icon name="close" size={20} /></button>
      </header>
      <h2>{doc.captionPl}</h2>
      {drafted && <p className="ct-odoc-basis">Art. 41 § 1 KPA</p>}
      {fields.length > 0 && (
        <dl>
          {fields.map(([k, v]) => (
            <div key={k}><dt>{LABEL_PL[k]}</dt><dd>{value(v)}</dd></div>
          ))}
        </dl>
      )}
    </article>
  );
}
