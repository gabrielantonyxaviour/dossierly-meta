import { DOCS, PERIOD_PHRASES, PURPOSES, type DocId } from "./corpus";

export const FOOTER_PL = "PRZYKŁAD — dokument fikcyjny wygenerowany do ewaluacji modeli. Nie pochodzi z urzędu.";
export const FOOTER_EN = "SAMPLE — fictional evaluation document. Names, numbers and dates are invented.";

const css = `*{box-sizing:border-box}html,body{margin:0;background:#fff}
body{width:1240px;height:1754px;padding:100px 110px;font-family:"Times New Roman","Liberation Serif",Times,serif;font-size:29px;line-height:1.5;color:#111;position:relative;overflow:hidden}
.r{text-align:right}.b{font-weight:bold}.c{text-align:center}h1{font-size:34px;margin:50px 0 4px;text-align:center}
h2{font-size:29px;text-align:center;margin:0 0 34px}p{margin:0 0 18px;text-align:justify}ol,ul{margin:0 0 18px;padding-left:50px}li{margin-bottom:6px}
.hd{margin-top:26px}.sig{margin-top:50px;text-align:right}.sm{font-size:24px;line-height:1.4}
.foot{position:absolute;left:110px;right:110px;bottom:70px;border-top:1px solid #999;padding-top:12px;font-size:21px;color:#444;font-family:Arial,Helvetica,sans-serif}
.stamp{position:absolute;top:96px;left:110px;font:bold 20px Arial;border:2px solid #b00;color:#b00;padding:3px 12px;transform:rotate(-3deg)}`;

export interface Spec {
  id: string;
  type: "wezwanie_braki" | "wezwanie_dokumenty" | "decision" | "appointment";
  variant: string;
  office: { name: string; unit: string; addr: string; city: string };
  caseNumber: string;
  letterDate: string; // dd.mm.yyyy
  filedDate: string;
  honorific: "Pan" | "Pani";
  name: string;
  address: readonly string[];
  purpose: (typeof PURPOSES)[number];
  docs: DocId[];
  days: number;
  phraseIdx: number;
  fixedDate?: string; // dd.mm.yyyy
  positive?: boolean;
  validUntil?: string;
  appointment?: { date: string; time: string; place: string; kind: "fingerprints" | "card" };
}

const acc = (h: "Pan" | "Pani") => (h === "Pan" ? "Pana" : "Panią");
const gen = (h: "Pan" | "Pani") => (h === "Pan" ? "Pana" : "Pani");
const fix = (s: string, h: "Pan" | "Pani") => s.replace("Pan/Pani", h);

export function renderHtml(s: Spec): { html: string; deadlineSentence: string } {
  const head = `<div class="stamp">PRZYKŁAD / SAMPLE</div>
<div class="r" style="margin-top:6px">${s.office.city}, dnia ${s.letterDate} r.</div>
<div class="hd"><span class="b">${s.office.name}</span><br>${s.office.unit}<br>${s.office.addr}</div>
<div class="r hd">Znak sprawy: <span class="b">${s.caseNumber}</span></div>
<div class="hd" style="margin-top:34px">${s.honorific} ${s.name}<br>${s.address.join("<br>")}</div>`;
  const sig = `<div class="sig">z upoważnienia Wojewody<br>Inspektor</div>`;
  const foot = `<div class="foot">${FOOTER_PL}<br>${FOOTER_EN}</div>`;
  const list = `<ol>${s.docs.map((d, i) => `<li>${fix(DOCS[d].pl, s.honorific)}${i === s.docs.length - 1 ? "." : i === s.docs.length - 2 ? " oraz" : ","}</li>`).join("")}</ol>`;
  const period = PERIOD_PHRASES[s.phraseIdx % PERIOD_PHRASES.length](s.days);
  let body = "";
  let sentence = "";
  const dl = (t: string) => `<span id="dl">${t}</span>`;
  if (s.type === "wezwanie_braki") {
    sentence = `Wymagane dokumenty należy złożyć ${period}, pod rygorem pozostawienia wniosku bez rozpoznania.`;
    const lead = s.variant === "address"
      ? `W związku z zawiadomieniem o zmianie adresu zamieszkania cudzoziemca, na podstawie art. 64 § 2 Kodeksu postępowania administracyjnego wzywam ${acc(s.honorific)} do uzupełnienia braków formalnych wniosku o udzielenie zezwolenia na pobyt czasowy w celu ${s.purpose}, złożonego w dniu ${s.filedDate} r., poprzez przedłożenie:`
      : `Na podstawie art. 64 § 2 Kodeksu postępowania administracyjnego wzywam ${acc(s.honorific)} do uzupełnienia braków formalnych wniosku o udzielenie zezwolenia na pobyt czasowy w celu ${s.purpose}, złożonego w dniu ${s.filedDate} r., poprzez przedłożenie:`;
    body = `<h1>WEZWANIE</h1><h2>do uzupełnienia braków formalnych wniosku</h2><p>${lead}</p>${list}<p>${dl(sentence)}</p>`;
  } else if (s.type === "wezwanie_dokumenty") {
    const lead = `W związku z postępowaniem w sprawie udzielenia zezwolenia na pobyt czasowy w celu ${s.purpose}, wszczętym wnioskiem z dnia ${s.filedDate} r., na podstawie art. 50 § 1 Kodeksu postępowania administracyjnego wzywam ${acc(s.honorific)} do przedłożenia:`;
    sentence = s.fixedDate ? `Dokumenty należy przedłożyć w terminie do dnia ${s.fixedDate} r.` : `Dokumenty należy przedłożyć ${period}.`;
    body = `<h1>WEZWANIE</h1><h2>do przedłożenia dokumentu</h2><p>${lead}</p>${list}<p>${dl(sentence)} Dokumenty można złożyć osobiście w urzędzie lub przesłać pocztą, podając znak sprawy.</p>`;
  } else if (s.type === "decision") {
    sentence = `Od niniejszej decyzji służy odwołanie do Szefa Urzędu do Spraw Cudzoziemców za pośrednictwem Wojewody w terminie ${s.days} dni od dnia doręczenia decyzji (art. 127 § 1 oraz art. 129 § 1–2 KPA).`;
    const verdict = s.positive
      ? `<p class="b c">udzielam zezwolenia na pobyt czasowy w celu ${s.purpose}<br>do dnia ${s.validUntil ?? "30.09.2028"} r.</p><p class="sm"><span class="b">Uzasadnienie.</span> Cudzoziemiec złożył wniosek wraz z wymaganymi dokumentami, uzupełnił braki formalne w terminie oraz przedstawił ubezpieczenie zdrowotne i dowód opłaty. Organ ustalił, że nie zachodzą okoliczności uzasadniające odmowę udzielenia zezwolenia.</p>`
      : `<p class="b c">odmawiam udzielenia zezwolenia na pobyt czasowy w celu ${s.purpose}</p><p class="sm"><span class="b">Uzasadnienie.</span> Organ ustalił, że cudzoziemiec nie wykazał posiadania stabilnego i regularnego źródła dochodu w wymaganej wysokości, a wezwany do uzupełnienia dokumentów nie przedłożył ich w wyznaczonym terminie.</p>`;
    body = `<h1>DECYZJA</h1><h2>${s.caseNumber}</h2><p class="sm" style="margin-bottom:10px">Na podstawie art. 104 i art. 107 Kodeksu postępowania administracyjnego oraz przepisów ustawy z dnia 12 grudnia 2013 r. o cudzoziemcach, po rozpatrzeniu wniosku ${gen(s.honorific)} ${s.name} z dnia ${s.filedDate} r.,</p>${verdict}<p class="sm"><span class="b">Pouczenie.</span> ${dl(sentence)}</p><p class="sm">Kartę pobytu odbiera się osobiście po powiadomieniu o jej gotowości.</p>`;
  } else {
    const a = s.appointment!;
    sentence = `dnia ${a.date} r. o godz. ${a.time}`;
    const what = a.kind === "fingerprints" ? "w celu pobrania odcisków linii papilarnych" : "w celu odbioru karty pobytu";
    const takes = a.kind === "fingerprints" ? "Należy zabrać ze sobą ważny dokument podróży (paszport) oraz niniejsze wezwanie." : "Należy zabrać paszport, dotychczasową kartę pobytu (jeśli była wydana) oraz niniejsze wezwanie.";
    body = `<h1>WEZWANIE</h1><h2>do osobistego stawiennictwa ${what}</h2><p>W związku z postępowaniem w sprawie udzielenia zezwolenia na pobyt czasowy w celu ${s.purpose}, na podstawie art. 50 § 1 Kodeksu postępowania administracyjnego wzywam ${acc(s.honorific)} do osobistego stawiennictwa:</p><p class="c b" style="font-size:33px">${dl(sentence)}<br>${a.place}</p><p>${what}. ${takes}</p><p class="sm">Pouczenie: niestawiennictwo bez usprawiedliwienia może skutkować nałożeniem kary porządkowej (art. 88 § 1 KPA).</p>`;
  }
  return { html: `<!doctype html><html lang="pl"><meta charset="utf-8"><style>${css}</style><body>${head}${body}${sig}${foot}</body></html>`, deadlineSentence: sentence };
}
