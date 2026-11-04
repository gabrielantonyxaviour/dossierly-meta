/**
 * Test letters, screens and emails for the fictional applicant Arjun Raman. The documents read like real ones (no
 * sample stamp), but the case number, people and addresses are fictional, there is no state emblem and no real
 * official is named. Sent only from dossierly.cosmiclan.com, never from a gov.pl address.
 */
export const SAMPLE_CASE_NO = "WSC-II-P.6151.48213.2026";
export const SAMPLE_SENDER = { email: "wsc@dossierly.cosmiclan.com", name: "Wydział Spraw Cudzoziemców" } as const;
export const SAMPLE_ADMIN_ALLOWLIST: Readonly<Record<string, string>> = { "darthstormer.ai@gmail.com": "Arjun Raman" };

export type SampleEmail = { subject: string; html: string; text: string };
export type SampleLetter = {
  id: string;
  kind: "letter" | "decision";
  titleEn: string;
  subjectPl: string;
  dateOnLetter: string;
  png: string;
  pdf: string;
  phonePhoto: string | null;
  email: SampleEmail;
};
export type SampleScreen = { id: string; kind: "mos_screen" | "upo" | "kiosk" | "inpol_status"; titleEn: string; png: string };

const OFFICE = "Mazowiecki Urząd Wojewódzki w Warszawie, Wydział Spraw Cudzoziemców, pl. Bankowy 3/5, 00-950 Warszawa";
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function makeEmail(o: { subjectPl: string; date: string; intro: string; points: string[]; deadline?: string; appointment?: string; outro: string; en: string }): SampleEmail {
  const subject = `${o.subjectPl} — ${SAMPLE_CASE_NO}`;
  const lines = [
    "Szanowny Panie Arjunie Ramanie,",
    `Uprzejmie informujemy, że w sprawie o znaku ${SAMPLE_CASE_NO} (wniosek z dnia 18.09.2026 r. o udzielenie zezwolenia na pobyt czasowy w celu kontynuacji studiów) wydano pismo z dnia ${o.date} r.: ${o.subjectPl}.`,
    `Organ: ${OFFICE}.`,
    o.intro,
    ...o.points,
    ...(o.appointment ? [`Termin stawiennictwa: ${o.appointment}`] : []),
    ...(o.deadline ? [o.deadline] : []),
    o.outro,
    "W załączeniu przekazujemy treść pisma (PDF i PNG).",
    "z upoważnienia Wojewody Mazowieckiego — Inspektor",
  ];
  const html = `<div style="font-family:Georgia,serif;font-size:15px;line-height:1.55;color:#111;max-width:640px">${lines.map((l) => `<p>${esc(l)}</p>`).join("")}</div>`;
  return { subject, html, text: lines.join("\n\n") };
}

const P = "/sample/letters/";
const DEADLINE_BRAKI = "w terminie 14 dni od dnia doręczenia niniejszego wezwania, pod rygorem pozostawienia wniosku bez rozpoznania";

export const SAMPLE_LETTERS: SampleLetter[] = [
  {
    id: "wezwanie-braki", kind: "letter", titleEn: "Request to complete formal deficiencies",
    subjectPl: "Wezwanie do uzupełnienia braków formalnych wniosku", dateOnLetter: "22.10.2026",
    png: `${P}wezwanie-braki.png`, pdf: `${P}wezwanie-braki.pdf`, phonePhoto: "/sample/photos/wezwanie-braki-phone.jpg",
    email: makeEmail({
      subjectPl: "Wezwanie do uzupełnienia braków formalnych wniosku", date: "22.10.2026",
      intro: "Na podstawie art. 64 § 2 Kodeksu postępowania administracyjnego wzywamy Pana do uzupełnienia braków formalnych wniosku poprzez:",
      points: ["1. przedłożenie umowy najmu lokalu, w którym Pan obecnie zamieszkuje,", "2. przedłożenie dokumentu potwierdzającego posiadanie ubezpieczenia zdrowotnego na cały okres pobytu,", "3. przedłożenie nowej, aktualnej fotografii spełniającej wymogi (35 × 45 mm)."],
      deadline: `Wymagane jest to ${DEADLINE_BRAKI}.`,
      outro: "Pozostajemy do dyspozycji.",
      en: "You must send your lease, proof of health insurance for your whole stay and a new photo that meets the requirements within 14 days of receiving this letter, otherwise your application will be left unexamined.",
    }),
  },
  {
    id: "wezwanie-odciski", kind: "letter", titleEn: "Summons to appear for fingerprints",
    subjectPl: "Wezwanie do osobistego stawiennictwa w celu pobrania odcisków linii papilarnych", dateOnLetter: "22.10.2026",
    png: `${P}wezwanie-odciski.png`, pdf: `${P}wezwanie-odciski.pdf`, phonePhoto: "/sample/photos/wezwanie-odciski-phone.jpg",
    email: makeEmail({
      subjectPl: "Wezwanie do osobistego stawiennictwa w celu pobrania odcisków linii papilarnych", date: "22.10.2026",
      intro: "Na podstawie art. 50 § 1 Kodeksu postępowania administracyjnego wzywamy Pana do osobistego stawiennictwa w celu pobrania odcisków linii papilarnych.",
      points: ["Należy zabrać ważny dokument podróży (paszport) oraz niniejsze wezwanie.", "Niestawiennictwo bez usprawiedliwienia może skutkować nałożeniem kary porządkowej (art. 88 § 1 KPA) oraz brakiem możliwości wydania karty pobytu."],
      appointment: "dnia 04.11.2026 r. o godz. 10:40, Wydział Spraw Cudzoziemców, ul. Marszałkowska 3/5, 00-624 Warszawa.",
      deadline: "Usprawiedliwienie niemożności stawiennictwa należy zgłosić w terminie 3 dni od wyznaczonej daty (art. 89 § 1 KPA).",
      outro: "Prosimy o punktualne stawiennictwo.",
      en: "You must appear in person on 04.11.2026 at 10:40 at ul. Marszałkowska 3/5, 00-624 Warszawa to give fingerprints. Bring your passport.",
    }),
  },
  {
    id: "wezwanie-zaswiadczenie", kind: "letter", titleEn: "Request for a certificate of enrolment",
    subjectPl: "Wezwanie do przedłożenia zaświadczenia o studiowaniu", dateOnLetter: "04.11.2026",
    png: `${P}wezwanie-zaswiadczenie.png`, pdf: `${P}wezwanie-zaswiadczenie.pdf`, phonePhoto: null,
    email: makeEmail({
      subjectPl: "Wezwanie do przedłożenia zaświadczenia o studiowaniu", date: "04.11.2026",
      intro: "Na podstawie art. 50 § 1 Kodeksu postępowania administracyjnego wzywamy Pana do przedłożenia:",
      points: ["1. aktualnego zaświadczenia z uczelni potwierdzającego kontynuację studiów (zaświadczenie o studiowaniu)."],
      deadline: "Termin: do dnia 25.11.2026 r.",
      outro: "Pozostajemy do dyspozycji.",
      en: "Send a current certificate of enrolment from your university by 25.11.2026.",
    }),
  },
  {
    id: "zawiadomienie-36", kind: "letter", titleEn: "Notice of delay (art. 36 KPA)",
    subjectPl: "Zawiadomienie o niezałatwieniu sprawy w terminie", dateOnLetter: "17.12.2026",
    png: `${P}zawiadomienie-36.png`, pdf: `${P}zawiadomienie-36.pdf`, phonePhoto: null,
    email: makeEmail({
      subjectPl: "Zawiadomienie o niezałatwieniu sprawy w terminie", date: "17.12.2026",
      intro: "Na podstawie art. 36 § 1 Kodeksu postępowania administracyjnego zawiadamiamy, że sprawa nie może zostać załatwiona w terminie określonym w art. 35 KPA z powodu konieczności przeprowadzenia dodatkowych czynności wyjaśniających.",
      points: ["Nowy przewidywany termin załatwienia sprawy: 30.01.2027 r.", "Pouczenie: na niezałatwienie sprawy w terminie służy prawo wniesienia ponaglenia do Szefa Urzędu do Spraw Cudzoziemców za pośrednictwem Wojewody Mazowieckiego (art. 37 § 1 KPA). Ponaglenie wnosi się w każdym czasie, bez opłaty skarbowej."],
      outro: "Przepraszamy za opóźnienie.",
      en: "Your case will not be decided in time; the new expected date is 30.01.2027. You may file a complaint for delay (ponaglenie) at any time.",
    }),
  },
  {
    id: "decyzja-pozytywna", kind: "decision", titleEn: "Decision granting a temporary residence permit",
    subjectPl: "Decyzja o udzieleniu zezwolenia na pobyt czasowy", dateOnLetter: "14.01.2027",
    png: `${P}decyzja-pozytywna.png`, pdf: `${P}decyzja-pozytywna.pdf`, phonePhoto: null,
    email: makeEmail({
      subjectPl: "Decyzja o udzieleniu zezwolenia na pobyt czasowy", date: "14.01.2027",
      intro: "Udzielono Panu zezwolenia na pobyt czasowy w celu kontynuacji studiów do dnia 30.09.2028 r.",
      points: ["Od decyzji służy odwołanie do Szefa Urzędu do Spraw Cudzoziemców za pośrednictwem Wojewody Mazowieckiego w terminie 14 dni od dnia doręczenia decyzji (art. 127 § 1 oraz art. 129 § 1–2 KPA).", "Kartę pobytu odbiera się osobiście po powiadomieniu o jej gotowości; należy zabrać paszport oraz dowód uiszczenia opłaty za wydanie karty pobytu w wysokości 100 zł."],
      outro: "Gratulujemy.",
      en: "Your temporary residence permit is granted until 30.09.2028. You may appeal within 14 days of delivery. Card collection costs 100 PLN.",
    }),
  },
];

const S = "/sample/screens/";
export const SAMPLE_SCREENS: SampleScreen[] = [
  { id: "mos-form", kind: "mos_screen", titleEn: "Online residence application form, personal data step", png: `${S}mos-form.png` },
  { id: "upo", kind: "upo", titleEn: "Filing receipt (UPO-style)", png: `${S}upo.png` },
  { id: "kiosk", kind: "kiosk", titleEn: "Office queue-ticket kiosk", png: `${S}kiosk.png` },
  { id: "inpol-status", kind: "inpol_status", titleEn: "Case status page", png: `${S}inpol-status.png` },
];

export const sampleLetterById = (id: string) => SAMPLE_LETTERS.find((l) => l.id === id);

/** Catalogue without email bodies, for the GET endpoint. */
export function publicCatalogue() {
  return {
    letters: SAMPLE_LETTERS.map(({ email, ...rest }) => ({ ...rest, emailSubject: email.subject })),
    screens: SAMPLE_SCREENS,
  };
}
