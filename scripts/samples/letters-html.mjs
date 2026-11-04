// Fictional sample letters (Arjun Raman). Not from any authority.
export const CASE_NO = "WSC-II-S.6151.48213.2026";
export const FOOTER_PL = "PRZYKŁAD — dokument fikcyjny wygenerowany przez Dossierly do testów. Nie pochodzi z urzędu.";
export const FOOTER_EN = "SAMPLE — fictional test document made by Dossierly.";

const css = `*{box-sizing:border-box}html,body{margin:0;background:#fff}
body{width:1240px;height:1754px;padding:100px 110px;font-family:"Times New Roman","Liberation Serif",Times,serif;font-size:29px;line-height:1.5;color:#111;position:relative}
.r{text-align:right}.b{font-weight:bold}.c{text-align:center}h1{font-size:34px;margin:50px 0 4px;text-align:center}
h2{font-size:29px;text-align:center;margin:0 0 34px}p{margin:0 0 18px;text-align:justify}ol,ul{margin:0 0 18px;padding-left:50px}li{margin-bottom:6px}
.hd{margin-top:26px}.sig{margin-top:60px;text-align:right}.sm{font-size:24px;line-height:1.4}
.foot{position:absolute;left:110px;right:110px;bottom:70px;border-top:1px solid #999;padding-top:12px;font-size:21px;color:#444;font-family:Arial,Helvetica,sans-serif}
.stamp{position:absolute;top:96px;left:110px;font:bold 20px Arial;border:2px solid #b00;color:#b00;padding:3px 12px;transform:rotate(-3deg)}`;

const head = (date) => `<div class="stamp">PRZYKŁAD / SAMPLE</div>
<div class="r" style="margin-top:6px">Warszawa, dnia ${date} r.</div>
<div class="hd"><span class="b">MAZOWIECKI URZĄD WOJEWÓDZKI W WARSZAWIE</span><br>Wydział Spraw Cudzoziemców<br>pl. Bankowy 3/5, 00-950 Warszawa</div>
<div class="r hd">Znak sprawy: <span class="b">${CASE_NO}</span></div>
<div class="hd" style="margin-top:34px">Pan Arjun Raman<br>ul. Złota 44 m. 12<br>00-120 Warszawa</div>`;
const sig = `<div class="sig">z upoważnienia Wojewody Mazowieckiego<br>Inspektor</div>`;
const foot = `<div class="foot">${FOOTER_PL}<br>${FOOTER_EN}</div>`;
const page = (date, body) => `<!doctype html><html lang="pl"><meta charset="utf-8"><style>${css}</style><body>${head(date)}${body}${sig}${foot}</body></html>`;

const braki = page("22.10.2026", `<h1>WEZWANIE</h1><h2>do uzupełnienia braków formalnych wniosku</h2>
<p>Na podstawie art. 64 § 2 Kodeksu postępowania administracyjnego wzywam Pana do uzupełnienia braków formalnych wniosku o udzielenie zezwolenia na pobyt czasowy w celu kontynuacji studiów, złożonego w dniu 18.09.2026 r., poprzez:</p>
<ol><li>przedłożenie aktualnego zaświadczenia z uczelni o kontynuacji studiów,</li>
<li>przedłożenie dokumentu potwierdzającego posiadanie ubezpieczenia zdrowotnego,</li>
<li>przedłożenie dowodu uiszczenia opłaty skarbowej w wysokości 340 zł.</li></ol>
<p><span class="b">w terminie 14 dni od dnia doręczenia niniejszego wezwania</span>, pod rygorem pozostawienia wniosku bez rozpoznania.</p>`);

const odciski = page("22.10.2026", `<h1>WEZWANIE</h1><h2>do osobistego stawiennictwa w celu pobrania odcisków linii papilarnych</h2>
<p>W związku z postępowaniem w sprawie udzielenia zezwolenia na pobyt czasowy w celu kontynuacji studiów, na podstawie art. 50 § 1 Kodeksu postępowania administracyjnego oraz przepisów ustawy z dnia 12 grudnia 2013 r. o cudzoziemcach dotyczących pobrania odcisków linii papilarnych, wzywam Pana do osobistego stawiennictwa:</p>
<p class="c b" style="font-size:33px">dnia 12.11.2026 r. o godz. 10:30<br>Wydział Spraw Cudzoziemców, ul. Marszałkowska 3/5, 00-624 Warszawa</p>
<p>w celu pobrania odcisków linii papilarnych. Należy zabrać ze sobą ważny dokument podróży (paszport) oraz niniejsze wezwanie.</p>
<p class="sm">Pouczenie: niestawiennictwo bez usprawiedliwienia może skutkować nałożeniem kary porządkowej (art. 88 § 1 KPA) oraz brakiem możliwości wydania karty pobytu i dalszego prowadzenia sprawy. Usprawiedliwienie niemożności stawiennictwa należy zgłosić w terminie 3 dni od wyznaczonej daty (art. 89 § 1 KPA).</p>`);

const art36 = page("17.12.2026", `<h1>ZAWIADOMIENIE</h1><h2>o niezałatwieniu sprawy w terminie</h2>
<p>Na podstawie art. 36 § 1 Kodeksu postępowania administracyjnego zawiadamiam, że sprawa o udzielenie zezwolenia na pobyt czasowy w celu kontynuacji studiów, wszczęta wnioskiem z dnia 18.09.2026 r., nie może zostać załatwiona w terminie określonym w art. 35 KPA.</p>
<p><span class="b">Przyczyna:</span> konieczność przeprowadzenia dodatkowych czynności wyjaśniających oraz duże obciążenie Wydziału.</p>
<p><span class="b">Nowy przewidywany termin załatwienia sprawy: 30.01.2027 r.</span></p>
<p class="sm">Pouczenie: na niezałatwienie sprawy w terminie służy Pani/Panu prawo wniesienia ponaglenia do Szefa Urzędu do Spraw Cudzoziemców za pośrednictwem Wojewody Mazowieckiego (art. 37 § 1 KPA). Ponaglenie wnosi się w każdym czasie, bez opłaty skarbowej; zawiera ono wskazanie organu, na którego bezczynność lub przewlekłe prowadzenie postępowania się skarży, oraz uzasadnienie (art. 37 § 2–3 KPA).</p>`);

const decyzja = page("14.01.2027", `<h1>DECYZJA</h1><h2>${CASE_NO}</h2>
<p class="sm" style="margin-bottom:10px">Na podstawie art. 104 i art. 107 Kodeksu postępowania administracyjnego oraz przepisów ustawy z dnia 12 grudnia 2013 r. o cudzoziemcach, po rozpatrzeniu wniosku Pana Arjuna Ramana, obywatela Indii, z dnia 18.09.2026 r.,</p>
<p class="b c">udzielam zezwolenia na pobyt czasowy w celu kontynuacji studiów<br>do dnia 30.09.2028 r.</p>
<p class="sm"><span class="b">Uzasadnienie.</span> Cudzoziemiec złożył wniosek wraz z wymaganymi dokumentami, uzupełnił braki formalne w terminie, przedstawił zaświadczenie o kontynuacji studiów na Politechnice Warszawskiej, ubezpieczenie zdrowotne oraz dowód opłaty. Organ ustalił, że nie zachodzą okoliczności uzasadniające odmowę udzielenia zezwolenia, a okres pobytu odpowiada przewidywanemu okresowi studiów.</p>
<p class="sm"><span class="b">Pouczenie.</span> Od niniejszej decyzji służy odwołanie do Szefa Urzędu do Spraw Cudzoziemców za pośrednictwem Wojewody Mazowieckiego w terminie 14 dni od dnia doręczenia decyzji (art. 127 § 1 oraz art. 129 § 1–2 KPA).</p>
<p class="sm"><span class="b">Karta pobytu.</span> Kartę pobytu odbiera się osobiście w Wydziale Spraw Cudzoziemców po powiadomieniu o jej gotowości. Należy zabrać paszport oraz dowód uiszczenia opłaty za wydanie karty pobytu w wysokości 100 zł.</p>`);

export const LETTERS = { "wezwanie-braki": braki, "wezwanie-odciski": odciski, "zawiadomienie-36": art36, "decyzja-pozytywna": decyzja };
