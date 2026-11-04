/*
 * The MOS temporary-residence application (purpose: studies), parts A-D.
 * Source: Rozporządzenie MSWiA z 10 kwietnia 2026 r. w sprawie wniosku o udzielenie cudzoziemcowi zezwolenia na pobyt czasowy,
 * Dz. U. 2026 poz. 553, załącznik nr 1 (the statutory form that MOS shows online), in force from 27 April 2026.
 * Labels are copied from that regulation. The on-screen MOS wording and step order can differ slightly from the printed model:
 * treat ids as stable and labelPl as the official wording. Parts E-G are in ./mos-form-e.ts.
 */
import { MOS_SECTIONS_E } from "./mos-form-e";
import { f, type MosSection } from "./mos-types";

export type { MosAttachment, MosField, MosFee, MosSection } from "./mos-types";
export { MOS_ANNEX_5_UNIVERSITY } from "./mos-form-e";
export { MOS_ATTACHMENTS_STUDY, MOS_FEES } from "./mos-attachments";

export const MOS_FORM_SOURCE = {
  regulation: "Dz. U. 2026 poz. 553, załącznik nr 1",
  url: "https://api.sejm.gov.pl/eli/acts/DU/2026/553/text.pdf",
  inForceFrom: "2026-04-27",
  fillingRule: "The application is filled in Polish (instruction 2). Where you have no data, choose \"brak\" (none) instead of leaving a required field empty (instruction 3).",
  verifiedOn: "2026-11-04",
} as const;

const homeAddress = (p: string) => [
  f(`${p}.1`, "Kraj", "Country", null, "Indie", "Country name in Polish.", true),
  f(`${p}.2`, "Województwo / Obwód / Prowincja / Stan", "State / province", null, "Tamil Nadu", "State or province, as written on your documents.", true),
  f(`${p}.3`, "Powiat / Region / Dystrykt / Hrabstwo", "District / county", null, "Chennai", "District, or \"brak\" if your country has none.", true),
  f(`${p}.4`, "Gmina", "Municipality", null, "Chennai", "Municipality or city council, or \"brak\".", true),
  f(`${p}.5`, "Miejscowość", "Town / city", null, "Chennai", "Town or city.", true),
  f(`${p}.6`, "Ulica", "Street", null, "Kalakshetra Colony, 4th Main Road", "Street name, or \"brak\".", true),
  f(`${p}.7`, "Numer domu", "House number", null, "14", "House or building number.", true),
  f(`${p}.8`, "Numer mieszkania", "Apartment number", null, "brak", "Flat number, or \"brak\".", false),
  f(`${p}.9`, "Kod pocztowy", "Postal code", null, "600 020", "Postal code in the local format.", true),
];

export const MOS_SECTIONS: MosSection[] = [
  {
    id: "A",
    titlePl: "A. DANE OSOBOWE CUDZOZIEMCA",
    titleEn: "A. Your personal data",
    fields: [
      f("A.1", "Nazwisko", "Surname", "documents.passport.surname", "RAMAN", "Surname exactly as in the passport, in Latin letters."),
      f("A.2", "Nazwiska poprzednie", "Previous surnames", null, "brak", "Earlier surnames, or \"brak\".", false),
      f("A.3", "Nazwisko rodowe", "Family name (birth surname)", null, "RAMAN", "Surname at birth.", true),
      f("A.4", "Imię (imiona)", "Given name(s)", "documents.passport.givenNames", "ARJUN", "All given names as in the passport."),
      f("A.5", "Imię (imiona) poprzednie", "Previous given name(s)", null, "brak", "Or \"brak\".", false),
      f("A.6", "Imię ojca", "Father's name", null, "SUNDARAM", "Father's given name.", true),
      f("A.7", "Imię matki", "Mother's name", null, "LAKSHMI", "Mother's given name.", true),
      f("A.8", "Nazwisko rodowe matki", "Mother's maiden name", null, "IYER", "Mother's surname at birth.", true),
      f("A.9", "Data urodzenia", "Date of birth", "documents.passport.birthDate", "1999-03-14", "Year, month, day. If no document shows it, enter the probable year of birth (instruction 4)."),
      f("A.10", "Płeć", "Sex", "documents.passport.sex", "M", "Enter M for male or K for female (instruction 5). K is the Polish letter for kobieta, not for \"F\"."),
      f("A.11", "Miejsce urodzenia", "Place of birth", "documents.passport.birthPlace", "Chennai", "Town of birth as in the passport."),
      f("A.12", "Państwo urodzenia", "Country of birth", null, "Indie", "Country in Polish."),
      f("A.13", "Narodowość", "Nationality (ethnic origin)", null, "indyjska", "Write your nationality in Polish, lower case."),
      f("A.14", "Obywatelstwo (obywatelstwa)", "Citizenship(s)", "documents.passport.nationality", "Indie", "Every citizenship you hold."),
      f("A.15", "Stan cywilny", "Marital status", null, "kawaler", "Use one of: panna, kawaler, mężatka, żonaty, rozwiedziona, rozwiedziony, wdowa, wdowiec (instruction 5)."),
      f("A.16", "Wykształcenie", "Education", null, "wyższe (licencjat)", "Highest education completed, in Polish (for example podstawowe, średnie, wyższe)."),
      f("A.17.1", "Rysopis: Wzrost", "Description: height (cm)", null, "178", "Height in centimetres.", true),
      f("A.17.2", "Rysopis: Kolor oczu", "Description: eye colour", null, "brązowy", "Eye colour in Polish.", true),
      f("A.17.3", "Rysopis: Znaki szczególne", "Description: special marks", null, "brak", "Scars or tattoos, or \"brak\".", false),
      f("A.18", "Numer PESEL (jeżeli został nadany)", "PESEL number (if assigned)", null, "brak", "11 digits if you already have a PESEL, otherwise \"brak\".", false),
      f("A.19", "Numer telefonu", "Telephone number", "profile.phone", "+48 512 440 718", "A number where the office can reach you, with country code."),
      f("A.20", "Adres poczty elektronicznej", "E-mail address", null, "arjun.raman@example.com", "An address you read daily: MOS sends the signing link and the certificate here."),
    ],
  },
  {
    id: "B",
    titlePl: "B. ADRES CUDZOZIEMCA",
    titleEn: "B. Your address abroad",
    fields: [...homeAddress("B.I"), ...homeAddress("B.II").map((x) => ({ ...x, required: false, hint: `${x.hint} Only if you lived in another country before.` }))],
  },
  {
    id: "C",
    titlePl: "C. DANE DOTYCZĄCE DOKUMENTU PODRÓŻY LUB INNEGO DOKUMENTU POTWIERDZAJĄCEGO TOŻSAMOŚĆ",
    titleEn: "C. Travel document (passport)",
    fields: [
      f("C.series", "Seria", "Series", null, "brak", "Series letters if the passport has any; many do not, then \"brak\".", false),
      f("C.number", "Numer", "Number", "documents.passport.number", "Z7462018", "Passport number exactly as printed."),
      f("C.issued", "Data wydania", "Date of issue", "documents.passport.issueDate", "2023-08-22", "Year, month, day."),
      f("C.expires", "Data upływu ważności", "Expiry date", "documents.passport.expiryDate", "2033-08-21", "Year, month, day."),
      f("C.authority", "Nazwa i kraj organu wydającego", "Issuing authority and country", "documents.passport.issuingAuthority", "Regional Passport Office Chennai, Indie", "Authority name and country, as printed."),
      f("C.others", "Liczba osób wpisanych do dokumentu podróży", "Number of other persons entered in the travel document", null, "0", "0 unless children are entered in your passport."),
    ],
  },
  {
    id: "D",
    titlePl: "D. MIEJSCE POBYTU CUDZOZIEMCA",
    titleEn: "D. Where you live in Poland",
    fields: [
      f("D.1", "Województwo", "Voivodeship", null, "mazowieckie", "Voivodeship of your address in Poland."),
      f("D.2", "Powiat", "County", null, "Warszawa", "Powiat. For Warsaw it is m. st. Warszawa."),
      f("D.3", "Gmina", "Municipality", null, "Warszawa", "Gmina."),
      f("D.4", "Miejscowość", "Town / city", "profile.city", "Warszawa", "City."),
      f("D.5", "Ulica", "Street", "documents.rental_agreement.address", "ul. Narbutta", "Street as in your rental agreement or dormitory registration."),
      f("D.6", "Numer domu", "House number", null, "23", "Building number."),
      f("D.7", "Numer mieszkania", "Apartment number", null, "14", "Flat number, or \"brak\".", false),
      f("D.8", "Kod pocztowy", "Postal code", "documents.rental_agreement.postalCode", "02-536", "Format 00-000."),
    ],
  },
  ...MOS_SECTIONS_E,
];
