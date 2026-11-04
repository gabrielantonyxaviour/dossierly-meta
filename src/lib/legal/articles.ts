/*
 * Verbatim official Polish legal text we cite next to every computed deadline.
 * Extracted on 2026-11-04 from the Sejm ELI register (api.sejm.gov.pl); line-break hyphenation of the PDF
 * removed and nothing else changed. Never paraphrase `paragraphs`: they are shown to the user as quotes.
 * KPA = Kodeks postępowania administracyjnego. UoC = ustawa o cudzoziemcach.
 */

export type ArticleId = "kpa41" | "kpa44" | "kpa57" | "kpa64" | "uoc108" | "uoc106f";

export interface LegalArticle {
  act: "KPA" | "UoC";
  article: string;
  title: string;
  /** Whole article, verbatim, paragraphs joined with their markers. */
  textPl: string;
  /** Paragraph (KPA §, UoC ust.) text verbatim, without the marker. */
  paragraphs: Record<string, string>;
  sourceUrl: string;
  isapUrl?: string;
  /** What exactly the text was taken from (consolidated text and any amendment in force). */
  sourceNote: string;
  verified: boolean;
  verifiedOn: "2026-11-04";
}

const ARTICLE_DATA: Record<ArticleId, Omit<LegalArticle, "textPl" | "verifiedOn" | "verified"> & { marker: "§" | "ust." }> = {
  kpa41: {
    act: "KPA",
    article: "41",
    title: "Duty to report a change of address",
    marker: "§",
    paragraphs: {
      "1": "W toku postępowania strony oraz ich przedstawiciele i pełnomocnicy mają obowiązek zawiadomić organ administracji publicznej o każdej zmianie swojego adresu.",
      "2": "W razie zaniedbania obowiązku określonego w § 1 doręczenie pisma pod dotychczasowym adresem ma skutek prawny.",
    },
    sourceUrl: "https://api.sejm.gov.pl/eli/acts/DU/2025/1691/text.pdf",
    isapUrl: "https://isap.sejm.gov.pl/isap.nsf/DocDetails.xsp?id=WDU20250001691",
    sourceNote: "Kodeks postępowania administracyjnego, tekst jednolity Dz. U. 2025 poz. 1691 (no later amendments found in the Sejm ELI register as of 2026-11-04).",
  },
  kpa44: {
    act: "KPA",
    article: "44",
    title: "Letter not collected: deemed delivered (awizo)",
    marker: "§",
    paragraphs: {
      "1": "W razie niemożności doręczenia pisma w sposób wskazany w art. 42 i 43: 1) operator pocztowy w rozumieniu ustawy z dnia 23 listopada 2012 r. – Prawo pocztowe przechowuje pismo przez okres 14 dni w swojej placówce pocztowej – w przypadku doręczania pisma przez operatora pocztowego; 2) pismo składa się na okres czternastu dni w urzędzie właściwej gminy (miasta) – w przypadku doręczania pisma przez pracownika urzędu gminy (miasta) lub upoważnioną osobę lub organ.",
      "2": "Zawiadomienie o pozostawieniu pisma wraz z informacją o możliwości jego odbioru w terminie siedmiu dni, licząc od dnia pozostawienia zawiadomienia w miejscu określonym w § 1, umieszcza się w oddawczej skrzynce pocztowej lub, gdy nie jest to możliwe, na drzwiach mieszkania adresata, jego biura lub innego pomieszczenia, w którym adresat wykonuje swoje czynności zawodowe, bądź w widocznym miejscu przy wejściu na posesję adresata.",
      "3": "W przypadku niepodjęcia przesyłki w terminie, o którym mowa w § 2, pozostawia się powtórne zawiadomienie o możliwości odbioru przesyłki w terminie nie dłuższym niż czternaście dni od daty pierwszego zawiadomienia.",
      "4": "Doręczenie uważa się za dokonane z upływem ostatniego dnia okresu, o którym mowa w § 1, a pismo pozostawia się w aktach sprawy.",
    },
    sourceUrl: "https://api.sejm.gov.pl/eli/acts/DU/2025/1691/text.pdf",
    isapUrl: "https://isap.sejm.gov.pl/isap.nsf/DocDetails.xsp?id=WDU20250001691",
    sourceNote: "Kodeks postępowania administracyjnego, tekst jednolity Dz. U. 2025 poz. 1691 (no later amendments found in the Sejm ELI register as of 2026-11-04).",
  },
  kpa57: {
    act: "KPA",
    article: "57",
    title: "How deadlines are counted",
    marker: "§",
    paragraphs: {
      "1": "Jeżeli początkiem terminu określonego w dniach jest pewne zdarzenie, przy obliczaniu tego terminu nie uwzględnia się dnia, w którym zdarzenie nastąpiło. Upływ ostatniego z wyznaczonej liczby dni uważa się za koniec terminu.",
      "2": "Terminy określone w tygodniach kończą się z upływem tego dnia w ostatnim tygodniu, który nazwą odpowiada początkowemu dniowi terminu.",
      "3": "Terminy określone w miesiącach kończą się z upływem tego dnia w ostatnim miesiącu, który odpowiada początkowemu dniowi terminu, a gdyby takiego dnia w ostatnim miesiącu nie było – w ostatnim dniu tego miesiąca.",
      "3a": "Terminy określone w latach kończą się z upływem tego dnia w ostatnim roku, który odpowiada początkowemu dniowi terminu, a gdyby takiego dnia w ostatnim roku nie było – w dniu poprzedzającym bezpośrednio ten dzień.",
      "4": "Jeżeli koniec terminu do wykonania czynności przypada na dzień uznany ustawowo za wolny od pracy lub na sobotę, termin upływa następnego dnia, który nie jest dniem wolnym od pracy ani sobotą.",
      "5": "Termin uważa się za zachowany, jeżeli przed jego upływem pismo zostało: 1) wysłane na adres do doręczeń elektronicznych organu administracji publicznej, a nadawca otrzymał dowód otrzymania, o którym mowa w art. 41 ustawy z dnia 18 listopada 2020 r. o doręczeniach elektronicznych; 2) nadane w polskiej placówce pocztowej operatora wyznaczonego w rozumieniu ustawy z dnia 23 listopada 2012 r. – Prawo pocztowe albo placówce pocztowej operatora świadczącego pocztowe usługi powszechne w innym państwie członkowskim Unii Europejskiej, Konfederacji Szwajcarskiej albo państwie członkowskim Europejskiego Porozumienia o Wolnym Handlu (EFTA) – stronie umowy o Europejskim Obszarze Gospodarczym; 3) złożone w polskim urzędzie konsularnym; 4) złożone przez żołnierza w dowództwie jednostki wojskowej; 5) złożone przez członka załogi statku morskiego kapitanowi statku; 6) złożone przez osobę pozbawioną wolności w administracji zakładu karnego.",
    },
    sourceUrl: "https://api.sejm.gov.pl/eli/acts/DU/2025/1691/text.pdf",
    isapUrl: "https://isap.sejm.gov.pl/isap.nsf/DocDetails.xsp?id=WDU20250001691",
    sourceNote: "Kodeks postępowania administracyjnego, tekst jednolity Dz. U. 2025 poz. 1691 (no later amendments found in the Sejm ELI register as of 2026-11-04).",
  },
  kpa64: {
    act: "KPA",
    article: "64",
    title: "Summons to fix formal defects (at least 7 days)",
    marker: "§",
    paragraphs: {
      "1": "Jeżeli w podaniu nie wskazano adresu wnoszącego i nie ma możności ustalenia tego adresu na podstawie posiadanych danych, podanie pozostawia się bez rozpoznania.",
      "2": "Jeżeli podanie nie spełnia innych wymagań ustalonych w przepisach prawa, należy wezwać wnoszącego do usunięcia braków w wyznaczonym terminie, nie krótszym niż siedem dni, z pouczeniem, że nieusunięcie tych braków spowoduje pozostawienie podania bez rozpoznania.",
    },
    sourceUrl: "https://api.sejm.gov.pl/eli/acts/DU/2025/1691/text.pdf",
    isapUrl: "https://isap.sejm.gov.pl/isap.nsf/DocDetails.xsp?id=WDU20250001691",
    sourceNote: "Kodeks postępowania administracyjnego, tekst jednolity Dz. U. 2025 poz. 1691 (no later amendments found in the Sejm ELI register as of 2026-11-04).",
  },
  uoc108: {
    act: "UoC",
    article: "108",
    title: "Legal stay while your residence application is pending",
    marker: "ust.",
    paragraphs: {
      "1": "Jeżeli termin na złożenie wniosku o udzielenie cudzoziemcowi zezwolenia na pobyt czasowy został zachowany i wniosek nie zawiera braków formalnych lub braki formalne zostały uzupełnione w terminie: 1) wojewoda wydaje cudzoziemcowi zaświadczenie potwierdzające złożenie wniosku o udzielenie zezwolenia na pobyt czasowy; 2) pobyt cudzoziemca na terytorium Rzeczypospolitej Polskiej uważa się za legalny od dnia złożenia wniosku do dnia, w którym decyzja w sprawie udzielenia zezwolenia na pobyt czasowy stanie się ostateczna.",
      "2": "Przepisu ust. 1 pkt 2 nie stosuje się w razie zawieszenia postępowania w sprawie udzielenia cudzoziemcowi zezwolenia na pobyt czasowy na wniosek strony.",
    },
    sourceUrl: "https://api.sejm.gov.pl/eli/acts/DU/2025/1079/text.pdf",
    isapUrl: "https://isap.sejm.gov.pl/isap.nsf/DocDetails.xsp?id=WDU20250001079",
    sourceNote: "Ustawa o cudzoziemcach, tekst jednolity Dz. U. 2025 poz. 1079, with art. 108 ust. 1 pkt 1 as amended by Dz. U. 2025 poz. 1794 art. 1 pkt 14 (https://api.sejm.gov.pl/eli/acts/DU/2025/1794/text.pdf), in force from 27 April 2026 (Monitor Polski 2026 poz. 370). The stamp in the passport became a certificate issued through MOS. Ust. 1 pkt 2 and ust. 2 are unchanged and identical in both texts.",
  },
  uoc106f: {
    act: "UoC",
    article: "106f",
    title: "Summons to submit supporting documents (at least 14 days)",
    marker: "ust.",
    paragraphs: {
      "1": "Wojewoda wzywa cudzoziemca do przedłożenia dokumentów niezbędnych do potwierdzenia danych zawartych we wniosku o udzielenie zezwolenia na pobyt czasowy i okoliczności uzasadniających ubieganie się o udzielenie tego zezwolenia w terminie nie krótszym niż 14 dni od dnia doręczenia wezwania. Określając termin, wojewoda ocenia czas niezbędny do uzyskania przez cudzoziemca określonego dokumentu. W przypadku, o którym mowa w art. 106d ust. 2, wojewoda wzywa cudzoziemca do przedłożenia oryginałów tych dokumentów.",
    },
    sourceUrl: "https://api.sejm.gov.pl/eli/acts/DU/2025/1794/text.pdf",
    isapUrl: "https://isap.sejm.gov.pl/isap.nsf/DocDetails.xsp?id=WDU20250001794",
    sourceNote: "New art. 106f inserted by Dz. U. 2025 poz. 1794 art. 1 (text taken from the amending act; in force from 27 April 2026 per Monitor Polski 2026 poz. 370).",
  },
};

export const ARTICLES: Record<ArticleId, LegalArticle> = Object.fromEntries(
  (Object.entries(ARTICLE_DATA) as Array<[ArticleId, (typeof ARTICLE_DATA)[ArticleId]]>).map(([id, a]) => {
    const { marker, ...rest } = a;
    const body = Object.entries(a.paragraphs)
      .map(([n, text]) => (marker === "§" ? `§ ${n}. ${text}` : `${n}. ${text}`))
      .join(" ");
    return [id, { ...rest, textPl: `Art. ${a.article}. ${body}`, verified: true, verifiedOn: "2026-11-04" as const }];
  }),
) as Record<ArticleId, LegalArticle>;

/** One paragraph verbatim ("1", "3a", ...). Throws when the paragraph does not exist: never returns invented text. */
export function quote(id: ArticleId, paragraph: string): string {
  const text = ARTICLES[id].paragraphs[paragraph];
  if (!text) throw new Error(`No paragraph ${paragraph} in ${id}`);
  return text;
}

/** "KPA art. 57 §4" / "Ustawa o cudzoziemcach art. 108 ust. 1" style label. */
export function articleLabel(id: ArticleId, paragraph?: string): string {
  const a = ARTICLES[id];
  const act = a.act === "KPA" ? "KPA" : "UoC";
  const p = paragraph ? (a.act === "KPA" ? ` §${paragraph}` : ` ust. ${paragraph}`) : "";
  return `${act} art. ${a.article}${p}`;
}
