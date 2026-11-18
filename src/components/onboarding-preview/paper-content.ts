import type { T } from "@/lib/i18n/translate";
import type { Need } from "./content";

// Structure inspected from this actual Mazowiecki public letter; all case content below is fictional.
export const layoutReference = "https://www.gov.pl/attachment/067ebc20-cde4-447a-b724-0f997a22284b";
type Evidence = { text: string };
type Paper = { heading: string; subject: string; intro: string; request: Evidence; detail: Evidence; items: string[]; closing: string; attachment: string };
export const paperStories: Record<Need, Paper> = {
  letters: {
    heading: "Pismo w sprawie dokumentów", subject: "Uzupełnienie dokumentacji w sprawie pobytowej",
    intro: "W związku z prowadzoną sprawą dotyczącą pobytu czasowego prosimy o uzupełnienie dokumentacji. W przekazanych materiałach nie odnaleziono czytelnej kopii potwierdzenia ubezpieczenia zdrowotnego.",
    request: { text: "kopii potwierdzenia ubezpieczenia zdrowotnego" },
    detail: { text: "18 listopada 2026 r." },
    items: ["sprawdzić czytelność danych na kopii dokumentu;", "oznaczyć odpowiedź podanym wyżej numerem sprawy;", "zachować kopię pisma oraz potwierdzenie przekazania dokumentu."],
    closing: "W razie wątpliwości dotyczących wskazanego dokumentu prosimy o kontakt z wydziałem i podanie numeru sprawy. Ułatwi to odnalezienie właściwej korespondencji.",
    attachment: "Przykładowa lista kontrolna dokumentów — 1 strona",
  },
  documents: {
    heading: "Lista kontrolna dokumentów", subject: "Materiały do omówienia przed złożeniem dokumentacji",
    intro: "Arjun przygotowuje teczkę do rozmowy o swojej sprawie. Poniższa lista jest notatką roboczą, a nie urzędowym wykazem wymaganych dokumentów.",
    request: { text: "Potwierdzenie ubezpieczenia zdrowotnego — do wyjaśnienia" },
    detail: { text: "Rodzaj dokumentu wymaga potwierdzenia w aktualnej instrukcji urzędu." },
    items: ["Formularz roboczy — przygotowany do sprawdzenia", "Fotografia — do porównania z aktualnymi wymaganiami", "Kopie dokumentów — uporządkowane w teczce"],
    closing: "Przy każdej niejasnej pozycji zapisz pytanie do urzędu. Nie traktuj tej listy jako kompletnego zestawu dokumentów dla rzeczywistej sprawy.",
    attachment: "Miejsce na własne pytania — notatka przykładowa",
  },
  deadlines: {
    heading: "Potwierdzenie terminu — przykład", subject: "Przykładowa wizyta informacyjna",
    intro: "W fikcyjnym scenariuszu Arjun otrzymał potwierdzenie wizyty informacyjnej. Dokument służy do pokazania, jak odróżnić termin spotkania od terminu przekazania dokumentów.",
    request: { text: "Wizyta informacyjna dotycząca dokumentacji" },
    detail: { text: "18 listopada 2026 r., godz. 10:30" },
    items: ["Sprawdź miejsce spotkania w autentycznym potwierdzeniu.", "Przygotuj pytania, które chcesz omówić.", "Zaplanuj czas na dojazd oraz sprawdzenie informacji."],
    closing: "Przed ustawieniem przypomnienia porównaj wszystkie dane z oryginalnym potwierdzeniem. W tym przykładzie nie dokonano żadnej rezerwacji.",
    attachment: "Przykładowa notatka do przypomnienia",
  },
  appointments: {
    heading: "Notatka przed wizytą", subject: "Pytania Arjuna do rozmowy z urzędem",
    intro: "Celem przykładowej rozmowy jest wyjaśnienie, czy w dokumentacji brakuje dodatkowych informacji. Arjun chce przygotować krótką listę pytań przed spotkaniem.",
    request: { text: "Wyjaśnienie brakujących dokumentów i sposobu ich przekazania" },
    detail: { text: "18 listopada 2026 r., godz. 10:30 — termin przykładowy" },
    items: ["Jakich dokumentów jeszcze brakuje?", "W jaki sposób mogę je przekazać?", "Gdzie znajdę te wskazówki na piśmie?"],
    closing: "Po rozmowie warto zapisać odpowiedzi i wskazane źródła informacji. Ta notatka nie zastępuje potwierdzenia wizyty ani instrukcji urzędu.",
    attachment: "Miejsce na odpowiedzi — notatka robocza",
  },
  communicate: {
    heading: "Projekt wiadomości", subject: "Prośba o potwierdzenie otrzymania dokumentów",
    intro: "Szanowni Państwo, w nawiązaniu do przykładowej sprawy PRZYKŁAD/2026/0142 zwracam się z uprzejmą prośbą o informację dotyczącą przekazanych dokumentów.",
    request: { text: "Czy mogą Państwo potwierdzić otrzymanie moich dokumentów?" },
    detail: { text: "Proszę również o informację, czy potrzebne są dodatkowe dokumenty." },
    items: ["Sprawdź odbiorcę przed wysłaniem prawdziwej wiadomości.", "Porównaj numer sprawy z własną korespondencją.", "Nie dodawaj danych, które nie są potrzebne do pytania."],
    closing: "Dziękuję za pomoc. Z poważaniem, Arjun Mehta — fikcyjny autor przykładowej wiadomości. Ten projekt nie został wysłany.",
    attachment: "Brak — projekt wiadomości w podglądzie",
  },
  updates: {
    heading: "Przykładowy przebieg sprawy", subject: "Notatka o zmianie statusu dokumentacji",
    intro: "Arjun porównuje nową informację z wcześniejszymi notatkami dotyczącymi fikcyjnej sprawy. Poniższy zapis ilustruje zmianę statusu, a nie wynik postępowania.",
    request: { text: "Dokumenty otrzymane" },
    detail: { text: "2 listopada 2026 r. — brak informacji o decyzji" },
    items: ["30 października — przygotowanie przykładowych dokumentów", "2 listopada — odnotowanie otrzymania dokumentów", "Dalsze instrukcje — brak w tym przykładzie"],
    closing: "Zachowaj treść oryginalnej aktualizacji i sprawdź, czy zawiera dodatkowe prośby. Nie wyciągaj wniosku o pozytywnej decyzji wyłącznie ze statusu otrzymania dokumentów.",
    attachment: "Przykładowa oś zdarzeń — 1 strona",
  },
};

/** Label and plain-language explanation of a marked passage, in the interface language. */
export function evidenceCopy(need: Need, kind: "request" | "detail", t: T) {
  const k = kind === "request" ? "Req" : "Det";
  return { label: t(`${need}${k}Label`), explanation: t(`${need}${k}Expl`) };
}
