import { CASE_NO } from "./letters-html.mjs";
const base = `*{box-sizing:border-box}body{margin:0;width:1440px;height:900px;font-family:Helvetica,Arial,sans-serif;background:#eef1f5;color:#1d2733;position:relative;overflow:hidden}
.bar{background:#27425e;color:#fff;padding:20px 48px;font-size:22px;font-weight:bold}`;
const wrap = (extra, body) => `<!doctype html><meta charset="utf-8"><style>${base}${extra}</style><body>${body}</body>`;

const fields = ["Nazwisko","Nazwisko poprzednie","Imię (imiona)","Imię ojca","Imię matki","Data urodzenia","Płeć","Miejsce urodzenia","Obywatelstwo","Seria i numer dokumentu podróży","Data wydania","Data ważności"];
const hint = { "Data urodzenia": "dd.mm.rrrr", "Data wydania": "dd.mm.rrrr", "Data ważności": "dd.mm.rrrr", "Płeć": "— wybierz —" };
export const SCREENS = {
 "mos-form": wrap(`.card{margin:24px 48px;background:#fff;border-radius:8px;padding:26px 40px;box-shadow:0 2px 8px #0002}.steps{display:flex;gap:10px;margin-bottom:18px;font-size:14px}.steps span{padding:6px 14px;border-radius:20px;background:#dde3ea}.steps .on{background:#27425e;color:#fff}
 h2{margin:0 0 18px;font-size:24px}.g{display:grid;grid-template-columns:1fr 1fr 1fr;gap:16px 28px}label{font-size:14px;font-weight:bold;display:block;margin-bottom:5px}.in{height:42px;border:1px solid #9aa7b5;border-radius:4px;padding:11px 12px;color:#99a;font-size:14px;background:#fff}
 .btn{margin-top:24px;display:inline-block;background:#27425e;color:#fff;padding:12px 30px;border-radius:4px;font-weight:bold}.btn.s{background:#fff;color:#27425e;border:1px solid #27425e;margin-right:12px}`,
 `<div class="bar">Wniosek o pobyt czasowy — formularz online</div><div class="card"><div class="steps"><span>1 Rodzaj sprawy</span><span class="on">2 Dane osobowe</span><span>3 Pobyt</span><span>4 Załączniki</span><span>5 Podsumowanie</span></div>
 <h2>Krok 2 z 5: Dane osobowe cudzoziemca</h2><div class="g">${fields.map(f=>`<div><label>${f}</label><div class="in">${hint[f]??""}</div></div>`).join("")}</div>
 <span class="btn s">Wstecz</span><span class="btn">Dalej</span></div>`),
 "upo": wrap(`.card{margin:50px auto;width:900px;background:#fff;border-radius:8px;padding:40px 56px;box-shadow:0 2px 8px #0002}h1{margin:0 0 6px;font-size:30px}.ok{color:#1b7a3d;font-weight:bold;margin-bottom:26px}table{width:100%;border-collapse:collapse;font-size:18px}td{padding:14px 6px;border-bottom:1px solid #dde3ea}td:first-child{color:#556;width:42%}td:last-child{font-weight:bold}`,
 `<div class="bar">Poświadczenie odbioru wniosku</div><div class="card"><h1>Urzędowe Poświadczenie Odbioru</h1><div class="ok">Wniosek został złożony i odebrany</div><table>
 <tr><td>Identyfikator poświadczenia</td><td>UPO-2026-09-18-0140791</td></tr><tr><td>Data i czas złożenia</td><td>18.09.2026 14:07</td></tr>
 <tr><td>Numer sprawy</td><td>${CASE_NO}</td></tr><tr><td>Rodzaj sprawy</td><td>Zezwolenie na pobyt czasowy w celu kontynuacji studiów</td></tr>
 <tr><td>Wnioskodawca</td><td>Arjun Raman</td></tr><tr><td>Organ</td><td>Mazowiecki Urząd Wojewódzki w Warszawie, Wydział Spraw Cudzoziemców</td></tr></table></div>`),
 "kiosk": wrap(`body{background:#14202e;color:#fff}.t{text-align:center;font-size:42px;font-weight:bold;margin:60px 0 10px}.s{text-align:center;font-size:22px;color:#b8c4d2;margin-bottom:40px}.g{display:grid;grid-template-columns:1fr 1fr 1fr;gap:28px;padding:0 70px}.k{height:210px;border-radius:18px;background:#2b4a6b;display:flex;flex-direction:column;align-items:center;justify-content:center;font-size:30px;font-weight:bold;text-align:center;padding:0 20px}.k b{font-size:80px;line-height:1}.k i{font-style:normal;font-size:20px;font-weight:normal;color:#c9d5e2}`,
 `<div class="t">Wybierz rodzaj sprawy / Choose your service</div><div class="s">Dotknij przycisku, aby pobrać numerek / Touch a button to take a ticket</div><div class="g">
 ${[["A","Złożenie wniosku","Application filing"],["B","Odciski palców","Fingerprints"],["C","Odbiór karty pobytu","Residence card collection"],["D","Informacja","Information"],["E","Uzupełnienie braków","Missing documents"]].map(([l,p,e])=>`<div class="k"><b>${l}</b>${p}<i>${e}</i></div>`).join("")}</div>`),
 "inpol-status": wrap(`.card{margin:44px auto;width:960px;background:#fff;border-radius:8px;padding:36px 52px;box-shadow:0 2px 8px #0002}h1{margin:0 0 24px;font-size:28px}.row{display:flex;padding:14px 0;border-bottom:1px solid #dde3ea;font-size:19px}.row span:first-child{width:260px;color:#556}.row span:last-child{font-weight:bold}.st{margin-top:26px;padding:20px 24px;background:#fff4d6;border-left:6px solid #e0a100;font-size:21px;font-weight:bold}.sm{font-size:15px;color:#556;font-weight:normal;margin-top:6px}`,
 `<div class="bar">Status sprawy cudzoziemca</div><div class="card"><h1>Informacja o sprawie</h1>
 <div class="row"><span>Numer sprawy</span><span>${CASE_NO}</span></div><div class="row"><span>Rodzaj sprawy</span><span>Pobyt czasowy — kontynuacja studiów</span></div>
 <div class="row"><span>Data złożenia</span><span>18.09.2026</span></div><div class="row"><span>Organ prowadzący</span><span>Mazowiecki Urząd Wojewódzki, WSC</span></div>
 <div class="st">W toku — oczekuje na uzupełnienie braków<div class="sm">In progress — awaiting missing documents</div></div></div>`),
};
