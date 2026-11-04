/*
 * The demo inbox for the film (fictional applicant Arjun Raman). The mails read like real ones, with no sample
 * marker; the case number, people and addresses are fictional, no real official is named, and every mail is
 * sent from dossierly.cosmiclan.com. Key facts sit in the body text so inbox readers can extract them.
 * Canonical data: case WSC-II-P.6151.48213.2026 filed in MOS 18 Sep 2026 from the dorm; lease at the new
 * flat from 1 Oct 2026; summons of 22 Oct 2026; fingerprints on the recording day at 10:40.
 */
import { SAMPLE_CASE_NO } from "./letters-samples";

export const DORM_ADDRESS = "DS Babilon, ul. Kickiego 12, 04-369 Warszawa";
export const FLAT_ADDRESS = "ul. Grzybowska 43A m. 12, 00-855 Warszawa";
const OFFICE = "Mazowiecki Urząd Wojewódzki w Warszawie, Wydział Spraw Cudzoziemców";
const OFFICE_EMAIL = "wsc@dossierly.cosmiclan.com";
const OTHER_EMAIL = "no-reply@dossierly.cosmiclan.com";

export interface FilmMailParams {
  /** YYYY-MM-DD, the recording day (fingerprint appointment). */
  date: string;
}
export interface BuiltMail {
  from: { email: string; name: string };
  subject: string;
  html: string;
  text: string;
  /** Public paths attached as PDF. */
  attachments: string[];
}
type Block = string | { facts: Array<[string, string]> };

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const pl = (d: string) => `${d.slice(8, 10)}.${d.slice(5, 7)}.${d.slice(0, 4)}`;

function render(blocks: Block[], official: boolean): { html: string; text: string } {
  const html = [
    `<div style="font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:1.55;color:#111;max-width:640px">`,
    ...blocks.map((b) =>
      typeof b === "string"
        ? `<p style="margin:0 0 14px">${esc(b)}</p>`
        : `<table style="border-collapse:collapse;margin:0 0 16px;font-size:16px">${b.facts.map(([k, v]) => `<tr><td style="padding:4px 14px 4px 0;color:#555;vertical-align:top">${esc(k)}</td><td style="padding:4px 0"><b>${esc(v)}</b></td></tr>`).join("")}</table>`,
    ),
    ...(official ? [`<p style="margin:0 0 14px">z upoważnienia Wojewody Mazowieckiego<br>Inspektor</p>`] : []),
    `</div>`,
  ].join("");
  const text = [...blocks.map((b) => (typeof b === "string" ? b : b.facts.map(([k, v]) => `${k}: ${v}`).join("\n"))), ...(official ? ["z upoważnienia Wojewody Mazowieckiego — Inspektor"] : [])].join("\n\n");
  return { html, text };
}

const mail = (from: BuiltMail["from"], subject: string, blocks: Block[], attachments: string[] = [], official = false): BuiltMail => ({ from, subject, attachments, ...render(blocks, official) });
const office = (name = "Wydział Spraw Cudzoziemców") => ({ email: OFFICE_EMAIL, name });

export const FILM_MAILS: Record<string, (p: FilmMailParams) => BuiltMail> = {
  "film-summons": () => mail(office(), `Wezwanie do uzupełnienia braków formalnych wniosku — ${SAMPLE_CASE_NO}`, [
    "Szanowny Panie,",
    `w załączeniu przekazujemy wezwanie z dnia 22.10.2026 r. w sprawie o znaku ${SAMPLE_CASE_NO} (wniosek z dnia 18.09.2026 r. o udzielenie zezwolenia na pobyt czasowy w celu kontynuacji studiów).`,
    { facts: [["Znak sprawy", SAMPLE_CASE_NO], ["Organ", OFFICE], ["Data pisma", "22.10.2026 r."], ["Adresat", `Pan Arjun Raman, ${DORM_ADDRESS}`], ["Podstawa", "art. 64 § 2 KPA"]] },
    "Na podstawie art. 64 § 2 Kodeksu postępowania administracyjnego wzywam Pana do uzupełnienia braków formalnych wniosku poprzez przedłożenie:",
    "1. umowy najmu lokalu, w którym Pan obecnie zamieszkuje,",
    "2. dokumentu potwierdzającego posiadanie ubezpieczenia zdrowotnego na cały okres pobytu,",
    "3. nowej, aktualnej fotografii spełniającej wymogi (35 × 45 mm),",
    "w terminie 14 dni od dnia doręczenia niniejszego wezwania, pod rygorem pozostawienia wniosku bez rozpoznania.",
  ], ["/sample/letters/wezwanie-braki.pdf"], true),

  "film-fingerprints": ({ date }) => mail(office("Rezerwacja wizyt WSC"), `Potwierdzenie wizyty: odciski palców, ${pl(date)} r., godz. 10:40`, [
    "Szanowny Panie,",
    `potwierdzamy termin wizyty w sprawie o znaku ${SAMPLE_CASE_NO}.`,
    { facts: [["Termin", `${pl(date)} r., godz. 10:40`], ["Miejsce", "Wydział Spraw Cudzoziemców, ul. Marszałkowska 3/5, 00-624 Warszawa"], ["Cel", "pobranie odcisków linii papilarnych"], ["Znak sprawy", SAMPLE_CASE_NO]] },
    "Prosimy zabrać ważny paszport. Prosimy o punktualne stawiennictwo.",
  ], [], true),

  "film-mos-confirmation": () => mail({ email: OFFICE_EMAIL, name: "MOS – Moduł Obsługi Spraw" }, `Potwierdzenie złożenia wniosku w MOS — ${SAMPLE_CASE_NO}`, [
    "Wniosek o udzielenie zezwolenia na pobyt czasowy został złożony elektronicznie.",
    { facts: [["Znak sprawy", SAMPLE_CASE_NO], ["Data złożenia", "18.09.2026 r."], ["Wnioskodawca", "Arjun Raman, obywatelstwo: Indie"], ["Cel pobytu", "kontynuacja studiów"], ["Adres zamieszkania (we wniosku)", DORM_ADDRESS], ["Organ", OFFICE]] },
    "Urzędowe poświadczenie przedłożenia (UPO) jest dostępne w MOS.",
  ]),

  "film-lease": () => mail({ email: OTHER_EMAIL, name: "Marta Kowalczyk" }, "Umowa najmu – Grzybowska 43A m. 12, od 1 października", [
    "Hi Arjun,",
    "here is the signed lease for the flat. Welcome!",
    { facts: [["Address", FLAT_ADDRESS], ["Lease from", "1 October 2026"], ["Lease until", "30 September 2027"], ["Rent", "2 900 zł / month"]] },
    "Keys are with the building manager. / W załączniku podpisana umowa najmu.",
    "Marta Kowalczyk",
  ], ["/sample/letters/umowa-najmu.pdf"]),

  "film-nfz": () => mail({ email: OTHER_EMAIL, name: "NFZ Mazowiecki OW" }, "Potwierdzenie: dobrowolne ubezpieczenie zdrowotne – student", [
    "Szanowny Panie,",
    "potwierdzamy zawarcie umowy o dobrowolne ubezpieczenie zdrowotne.",
    { facts: [["Ubezpieczony", "Arjun Raman"], ["Tytuł", "student – cudzoziemiec"], ["Nr umowy", "07/DUZ/2026/04817"], ["Ubezpieczenie od", "01.10.2026 r."], ["Okres", "na czas nieokreślony (cały okres pobytu)"]] },
  ]),

  "film-agency": () => mail({ email: OTHER_EMAIL, name: "LegalStay Warszawa" }, "Oferta: legalizacja pobytu dla Arjun Raman", [
    "Dzień dobry Panie Arjunie,",
    "dziękujemy za kontakt. Przesyłamy ofertę:",
    { facts: [["Kompleksowa legalizacja pobytu", "4 900 zł"], ["Zakres", "wniosek, korespondencja z urzędem, uzupełnianie braków"], ["Płatność", "z góry"]] },
    "Zespół LegalStay",
  ]),

  "film-enrolment-request": () => mail(office(), `Wezwanie do przedłożenia zaświadczenia o studiowaniu — termin 25.11.2026 — ${SAMPLE_CASE_NO}`, [
    "Szanowny Panie,",
    `w załączeniu przekazujemy wezwanie w sprawie o znaku ${SAMPLE_CASE_NO}.`,
    { facts: [["Znak sprawy", SAMPLE_CASE_NO], ["Organ", OFFICE], ["Podstawa", "art. 50 § 1 KPA"], ["Wymagany dokument", "aktualne zaświadczenie z uczelni o kontynuacji studiów"], ["Termin", "do 25.11.2026 r. (środa)"]] },
    "Na podstawie art. 50 § 1 Kodeksu postępowania administracyjnego wzywam Pana do przedłożenia aktualnego zaświadczenia z uczelni potwierdzającego kontynuację studiów w terminie do dnia 25.11.2026 r.",
  ], ["/sample/letters/wezwanie-zaswiadczenie.pdf"], true),
};

/** Send order for the inbox seed: oldest first, so the three office mails end up on top. */
export const FILM_SEED = ["film-agency", "film-nfz", "film-lease", "film-mos-confirmation", "film-fingerprints", "film-summons"] as const;

export const warsawToday = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Warsaw" }).format(new Date());
