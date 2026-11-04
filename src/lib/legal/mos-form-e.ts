/* MOS application parts E-G (additional information, justification, declaration) and the university's Annex 5. Source: Dz. U. 2026 poz. 553, załączniki nr 1 and 5. */
import { f, type MosSection } from "./mos-types";

const yesNo = (id: string, labelPl: string, labelEn: string, hint: string): ReturnType<typeof f> =>
  f(id, labelPl, labelEn, null, "Nie", `${hint} Answer Tak (yes) or Nie (no); if you answer Tak, a detail box opens.`);

export const MOS_SECTIONS_E: MosSection[] = [
  {
    id: "E",
    titlePl: "E. INFORMACJE DODATKOWE",
    titleEn: "E. Additional information",
    fields: [
      f(
        "E.I",
        "Główny cel pobytu uzasadniający udzielenie zezwolenia na pobyt czasowy",
        "Main purpose of stay",
        null,
        "podjęcie lub kontynuacja stacjonarnych: studiów pierwszego stopnia, studiów drugiego stopnia lub jednolitych studiów magisterskich albo kształcenie się w szkole doktorskiej",
        "Choose exactly one purpose. For a student it is option 6, the studies option. Your university completes Annex 5 for it.",
      ),
      f("E.II", "Członkowie rodziny cudzoziemca zamieszkujący na terytorium Rzeczypospolitej Polskiej", "Family members living in Poland", null, "brak", "Name, sex, date of birth, kinship, citizenship, residence, whether they apply for a permit and whether you support them. Write \"brak\" if none.", false),
      f("E.III.a", "poprzednie pobyty na terytorium Rzeczypospolitej Polskiej (okresy i podstawa pobytu)", "Previous stays in Poland (periods and legal basis)", null, "brak", "Earlier stays with dates and basis (visa, permit, visa-free). \"brak\" if this is your first.", false),
      f("E.III.b.1", "Czy przebywa Pan(-i) na terytorium Rzeczypospolitej Polskiej?", "Are you currently in Poland?", null, "Tak", "Tak if you are in Poland now. You must file no later than the last day of your legal stay (art. 105 ust. 1 of the Act)."),
      f("E.III.b.2", "Proszę podać datę ostatniego wjazdu Pana(-i) na terytorium Rzeczypospolitej Polskiej", "Date of your last entry to Poland", "profile.arrivalDate", "2026-09-17", "Year, month, day. Check the stamp in your passport."),
      f("E.III.b.3", "Na jakiej podstawie przebywa Pan(-i) aktualnie na terytorium Rzeczypospolitej Polskiej?", "On what basis are you in Poland now?", null, "wizy", "Tick one: ruchu bezwizowego, wizy, zezwolenia na pobyt czasowy, or dokumentu uprawniającego do wjazdu i pobytu wydanego przez inne państwo obszaru Schengen. A student on a national study visa ticks wizy; someone extending an earlier permit ticks zezwolenia na pobyt czasowy."),
      f("E.IV", "Podróże i pobyty zagraniczne cudzoziemca poza terytorium Rzeczypospolitej Polskiej w okresie ostatnich 5 lat (państwo, okres pobytu)", "Trips and stays abroad outside Poland in the last 5 years", null, "Indie 2021-2026; Niemcy 2024-07-01 do 2024-07-14", "Country and period for each stay abroad, last 5 years.", true),
      f("E.V", "Informacja o środkach finansowych na pokrycie kosztów utrzymania cudzoziemca", "Financial means to cover your living costs", null, "Stypendium rodziców i oszczędności: 4 200 zł miesięcznie", "Monthly amount and source (family support, scholarship, work). The Act requires means above the social-assistance income threshold after housing costs, plus return travel and study costs (art. 144 ust. 1 pkt 2 lit. b, ust. 1a)."),
      f("E.VI", "Informacja o posiadanym przez cudzoziemca ubezpieczeniu zdrowotnym", "Your health insurance", "documents.health_insurance.policyNumber", "Polisa nr PL-2026-004417, ważna do 2027-09-30", "Insurer, policy number and validity. NFZ cover or private cover of treatment costs in Poland both qualify (art. 144 ust. 1 pkt 2 lit. a)."),
      yesNo("E.VII", "Czy jest Pan(-i) zatrzymany(-na) albo umieszczony(-na) w strzeżonym ośrodku lub w areszcie dla cudzoziemców, czy został wobec Pana(-i) zastosowany środek zapobiegawczy w postaci zakazu opuszczania kraju, czy odbywa Pan(-i) karę pozbawienia wolności lub czy zastosowano wobec Pana(-i) tymczasowe aresztowanie?", "Are you detained, in a guarded centre, banned from leaving the country, serving a prison sentence or in pre-trial detention?", "Answer for yourself truthfully."),
      yesNo("E.VIII", "Czy był(-a) Pan(-i) karany(-na) sądownie na terytorium Rzeczypospolitej Polskiej?", "Have you been convicted by a court in Poland?", "Only convictions in Poland."),
      yesNo("E.IX", "Czy toczy się przeciwko Panu(-i) postępowanie karne lub postępowanie w sprawach o wykroczenia na terytorium Rzeczypospolitej Polskiej?", "Are criminal or petty-offence proceedings pending against you in Poland?", "Include fines you contest."),
      yesNo("E.X", "Czy ciążą na Panu(-i) zobowiązania wynikające z orzeczeń sądowych, postanowień i decyzji administracyjnych, w tym zobowiązania alimentacyjne, na terytorium Rzeczypospolitej Polskiej lub poza tym terytorium?", "Do you owe obligations from court rulings or administrative decisions, including maintenance, in Poland or abroad?", "Includes unpaid maintenance and unpaid administrative fines."),
    ],
  },
  {
    id: "F",
    titlePl: "F. UZASADNIENIE WNIOSKU",
    titleEn: "F. Justification of the application",
    fields: [
      f("F.1", "UZASADNIENIE WNIOSKU", "Why you are applying", "profile.organisation", "Jestem studentem drugiego roku studiów magisterskich w Szkole Głównej Handlowej w Warszawie. Proszę o zezwolenie na pobyt czasowy w celu kontynuacji studiów do 2027-06-30.", "Two or three Polish sentences: your programme, university, and the period you need the permit for. Keep it factual."),
    ],
  },
  {
    id: "G",
    titlePl: "G. OŚWIADCZENIE",
    titleEn: "G. Declaration and signature",
    fields: [
      f("G.1", "Oświadczam, że dane zawarte we wniosku są prawdziwe.", "I declare the data in the application is true.", null, "Tak", "A statement you make yourself. Dossierly never ticks or signs this for you."),
      f("G.2", "Jestem świadomy odpowiedzialności karnej za złożenie fałszywego oświadczenia.", "I am aware of criminal liability for a false statement.", null, "Tak", "Same: you tick it yourself."),
      f("G.sign", "kwalifikowany podpis elektroniczny, podpis osobisty, podpis zaufany", "Qualified electronic signature, personal signature or trusted signature", null, "podpis zaufany (login.gov.pl)", "You sign personally in MOS through login.gov.pl. The application cannot be signed by a proxy; it is only unlocked after your university completes its annex."),
    ],
  },
];

/** What your university enters in Annex 5 (the e-form replacing the paper "zaświadczenie"). Dz. U. 2026 poz. 553, załącznik nr 5. */
export const MOS_ANNEX_5_UNIVERSITY: Array<{ id: string; labelPl: string; labelEn: string }> = [
  { id: "I", labelPl: "Dane osobowe cudzoziemca", labelEn: "Your name, date of birth and citizenship, prefilled from your application" },
  { id: "II.1", labelPl: "Nazwa", labelEn: "University name" },
  { id: "II.2", labelPl: "Adres siedziby", labelEn: "University address" },
  { id: "II.3", labelPl: "Numer REGON", labelEn: "University REGON number" },
  { id: "II.4", labelPl: "Numer telefonu", labelEn: "University phone" },
  { id: "II.5", labelPl: "Adres poczty elektronicznej", labelEn: "University e-mail (the one you gave in your application, where MOS sends the link)" },
  { id: "II.6", labelPl: "Data rozpoczęcia i data zakończenia kształcenia na studiach", labelEn: "Start and end date of your studies" },
  { id: "II.7", labelPl: "Kierunek studiów, a w przypadku szkoły doktorskiej – dyscypliny naukowe albo artystyczne", labelEn: "Programme (or doctoral disciplines)" },
  { id: "II.8", labelPl: "Określenie poziomu studiów i informacja o ich odpłatności", labelEn: "Study level and whether it is paid" },
  { id: "II.9", labelPl: "Informacja, w jakim języku odbywają się studia, oraz o poziomie biegłości językowej wymaganym do ich odbycia", labelEn: "Language of instruction and required proficiency" },
  { id: "II.10", labelPl: "Informacja, czy cudzoziemiec jest objęty programem unijnym lub programem wielostronnym obejmującym środki w zakresie mobilności lub porozumieniem między przynajmniej dwiema instytucjami szkolnictwa wyższego przewidującym mobilność wewnątrzunijną", labelEn: "Whether you are in an EU or multilateral mobility programme or inter-university agreement" },
];
