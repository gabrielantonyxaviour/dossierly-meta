/*
 * Fictional corpus for the Muse evaluation. Every person, case number and address below is invented.
 * Wording follows the structure of the repo's sample letters (scripts/samples/letters-html.mjs).
 */
export type DocId = "lease" | "insurance" | "photo" | "enrolment" | "passport" | "funds" | "meldunek" | "address_decl" | "fees" | "work_contract" | "tuition";
export const DOCS: Record<DocId, { pl: string; en: string }> = {
  lease: { pl: "umowy najmu lokalu, w którym Pan/Pani obecnie zamieszkuje", en: "lease agreement" },
  insurance: { pl: "dokumentu potwierdzającego posiadanie ubezpieczenia zdrowotnego na cały okres pobytu", en: "health insurance" },
  photo: { pl: "nowej, aktualnej fotografii spełniającej wymogi (35 × 45 mm)", en: "photo" },
  enrolment: { pl: "aktualnego zaświadczenia z uczelni potwierdzającego kontynuację studiów (zaświadczenie o studiowaniu)", en: "certificate of enrolment" },
  passport: { pl: "kopii wszystkich wypełnionych stron ważnego dokumentu podróży", en: "passport copy" },
  funds: { pl: "wyciągu z rachunku bankowego potwierdzającego posiadanie stabilnego i regularnego źródła dochodu", en: "bank statement" },
  meldunek: { pl: "zaświadczenia o zameldowaniu pod nowym adresem pobytu", en: "registration of address" },
  address_decl: { pl: "pisemnego oświadczenia o zmianie adresu zamieszkania", en: "declaration of address change" },
  fees: { pl: "dowodu uiszczenia opłaty skarbowej", en: "payment of fee" },
  work_contract: { pl: "umowy o pracę lub zaświadczenia o zatrudnieniu", en: "employment contract" },
  tuition: { pl: "dowodu opłacenia czesnego za bieżący rok akademicki", en: "tuition receipt" },
};

/** Keyword patterns used to score requested documents against the model's asks/asksLocal text. */
export const DOC_PATTERNS: Record<DocId, string> = {
  lease: "najm|lease|rental|tenan",
  insurance: "ubezpiecz|insurance",
  photo: "fotograf|zdj[eę]ci|photo",
  enrolment: "zaświadczeni\\w* (z uczelni|o studiowaniu)|studiowan|uczelni|enrol|university|certificate of (study|enrol)",
  passport: "dokument\\w* podróży|paszport|passport|travel document",
  funds: "wyciąg|rachun|dochod|bank|income|funds",
  meldunek: "zamelduj|zameldowan|registration of (residence|address)|registered",
  address_decl: "oświadczeni|declaration|statement",
  fees: "opłat\\w* skarbow|stamp|fee",
  work_contract: "umow\\w* o pracę|zatrudnien|employ",
  tuition: "czesn|tuition",
};

export const NAMES = [
  ["Pan", "Oleksandr Bondarenko"], ["Pani", "Nguyen Thi Lan"], ["Pan", "Rahul Menon"], ["Pani", "Aigerim Sadykova"],
  ["Pan", "Mehmet Aydın"], ["Pani", "Yuliia Kovalenko"], ["Pan", "Tran Minh Quan"], ["Pani", "Priya Venkataraman"],
  ["Pan", "Dmitri Volkov"], ["Pani", "Ayşe Demir"], ["Pan", "Kwame Mensah"], ["Pani", "Svitlana Hrytsenko"],
  ["Pan", "Farid Karimov"], ["Pani", "Mai Anh Tuan"], ["Pan", "Arjun Nair"], ["Pani", "Dilnoza Rakhimova"],
  ["Pan", "Hassan El-Amrani"], ["Pani", "Olena Petrenko"], ["Pan", "Sergei Antonov"], ["Pani", "Anjali Deshmukh"],
  ["Pan", "Bakhtiyor Yusupov"], ["Pani", "Thi Hoa Pham"], ["Pan", "Ivan Melnyk"], ["Pani", "Kavya Subramanian"],
  ["Pan", "Emre Yıldız"], ["Pani", "Nargiza Tashkentova"], ["Pan", "Vikram Chatterjee"], ["Pani", "Daria Shevchuk"],
] as const;

export const ADDRESSES = [
  ["DS Olimp", "ul. Kickiego 12", "04-369 Warszawa"], ["ul. Grzybowska 43A m. 12", "00-855 Warszawa"],
  ["ul. Wrocławska 8 m. 4", "30-006 Kraków"], ["os. Jagiellońskie 5/21", "31-833 Kraków"],
  ["ul. Pułaskiego 17 m. 3", "02-595 Warszawa"], ["ul. Piastowska 52", "30-067 Kraków"],
] as const;

export const OFFICES = {
  waw: { name: "MAZOWIECKI URZĄD WOJEWÓDZKI W WARSZAWIE", unit: "Wydział Spraw Cudzoziemców", addr: "pl. Bankowy 3/5, 00-950 Warszawa", city: "Warszawa", prefix: "WSC-II-P.6151", place: "Wydział Spraw Cudzoziemców, ul. Marszałkowska 3/5, 00-624 Warszawa" },
  krk: { name: "MAŁOPOLSKI URZĄD WOJEWÓDZKI W KRAKOWIE", unit: "Wydział Spraw Obcokrajowców", addr: "ul. Basztowa 22, 31-156 Kraków", city: "Kraków", prefix: "WSO-III.6151", place: "Wydział Spraw Obcokrajowców, ul. Mikołajska 5, 31-027 Kraków" },
} as const;

export const PURPOSES = ["kontynuacji studiów", "wykonywania pracy", "połączenia z rodziną", "prowadzenia badań naukowych"] as const;
export const PERIOD_PHRASES = [
  (n: number) => `w terminie ${n} dni od dnia doręczenia niniejszego wezwania`,
  (n: number) => `w terminie ${n} dni od daty doręczenia niniejszego wezwania`,
  (n: number) => `w ciągu ${n} dni od dnia otrzymania niniejszego wezwania`,
];
