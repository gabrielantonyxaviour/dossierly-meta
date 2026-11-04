// Fictional sample letters (Arjun Raman). Not from any authority.
export const CASE_NO = "WSC-II-P.6151.48213.2026";
export const FOOTER_PL = "PRZYKŁAD — dokument fikcyjny wygenerowany przez Dossierly do testów. Nie pochodzi z urzędu.";
export const FOOTER_EN = "SAMPLE — fictional test document made by Dossierly.";

const css = `*{box-sizing:border-box}html,body{margin:0;background:#fff}
body{width:1240px;height:1754px;padding:100px 110px;font-family:"Times New Roman","Liberation Serif",Times,serif;font-size:29px;line-height:1.5;color:#111;position:relative}
.r{text-align:right}.b{font-weight:bold}.c{text-align:center}h1{font-size:34px;margin:50px 0 4px;text-align:center}
h2{font-size:29px;text-align:center;margin:0 0 34px}p{margin:0 0 18px;text-align:justify}ol,ul{margin:0 0 18px;padding-left:50px}li{margin-bottom:6px}
.hd{margin-top:26px}.sig{margin-top:60px;text-align:right}.sm{font-size:24px;line-height:1.4}
.foot{position:absolute;left:110px;right:110px;bottom:70px;border-top:1px solid #999;padding-top:12px;font-size:21px;color:#444;font-family:Arial,Helvetica,sans-serif}
.stamp{position:absolute;top:96px;left:110px;font:bold 20px Arial;border:2px solid #b00;color:#b00;padding:3px 12px;transform:rotate(-3deg)}`;

export const DORM = ["DS Babilon", "ul. Kickiego 12", "04-369 Warszawa"];
export const FLAT = ["ul. Grzybowska 43A m. 12", "00-855 Warszawa"];
const head = (date, to = DORM) => `<div class="stamp">PRZYKŁAD / SAMPLE</div>
<div class="r" style="margin-top:6px">Warszawa, dnia ${date} r.</div>
<div class="hd"><span class="b">MAZOWIECKI URZĄD WOJEWÓDZKI W WARSZAWIE</span><br>Wydział Spraw Cudzoziemców<br>pl. Bankowy 3/5, 00-950 Warszawa</div>
<div class="r hd">Znak sprawy: <span class="b">${CASE_NO}</span></div>
<div class="hd" style="margin-top:34px">Pan Arjun Raman<br>${to.join("<br>")}</div>`;
const sig = `<div class="sig">z upoważnienia Wojewody Mazowieckiego<br>Inspektor</div>`;
const foot = `<div class="foot">${FOOTER_PL}<br>${FOOTER_EN}</div>`;
const page = (date, body, to) => `<!doctype html><html lang="pl"><meta charset="utf-8"><style>${css}</style><body>${head(date, to)}${body}${sig}${foot}</body></html>`;

const braki = page("22.10.2026", `<h1>WEZWANIE</h1><h2>do uzupełnienia braków formalnych wniosku</h2>
<p>Na podstawie art. 64 § 2 Kodeksu postępowania administracyjnego wzywam Pana do uzupełnienia braków formalnych wniosku o udzielenie zezwolenia na pobyt czasowy w celu kontynuacji studiów, złożonego w dniu 18.09.2026 r., poprzez przedłożenie:</p>
<ol><li>umowy najmu lokalu, w którym Pan obecnie zamieszkuje,</li>
<li>dokumentu potwierdzającego posiadanie ubezpieczenia zdrowotnego na cały okres pobytu,</li>
<li>nowej, aktualnej fotografii spełniającej wymogi (35 × 45 mm).</li></ol>
<p><span class="b">w terminie 14 dni od dnia doręczenia niniejszego wezwania</span>, pod rygorem pozostawienia wniosku bez rozpoznania.</p>`);

const zaswiadczenie = page("04.11.2026", `<h1>WEZWANIE</h1><h2>do przedłożenia dokumentu</h2>
<p>W związku z postępowaniem w sprawie udzielenia zezwolenia na pobyt czasowy w celu kontynuacji studiów, wszczętym wnioskiem z dnia 18.09.2026 r., na podstawie art. 50 § 1 Kodeksu postępowania administracyjnego wzywam Pana do przedłożenia:</p>
<ol><li>aktualnego zaświadczenia z uczelni potwierdzającego kontynuację studiów (zaświadczenie o studiowaniu).</li></ol>
<p><span class="b">w terminie do dnia 25.11.2026 r.</span></p>
<p>Dokument można złożyć osobiście w Wydziale Spraw Cudzoziemców, ul. Marszałkowska 3/5, 00-624 Warszawa, lub przesłać pocztą na adres urzędu, podając znak sprawy.</p>`, FLAT);

const leaseCss = css.replace("padding:100px 110px", "padding:110px 120px").replace("font-size:29px", "font-size:27px");
const lease = `<!doctype html><html lang="pl"><meta charset="utf-8"><style>${leaseCss}</style><body>
<div class="stamp">PRZYKŁAD / SAMPLE</div>
<h1 style="margin-top:70px">UMOWA NAJMU LOKALU MIESZKALNEGO</h1>
<p class="c">zawarta w dniu 28.09.2026 r. w Warszawie pomiędzy:</p>
<p><span class="b">Panią Martą Kowalczyk</span>, zwaną dalej „Wynajmującą”,<br>a <span class="b">Panem Arjunem Ramanem</span>, obywatelem Indii, legitymującym się paszportem nr Z7341982, zwanym dalej „Najemcą”.</p>
<p class="c b">§ 1. Przedmiot najmu</p>
<p>Wynajmująca oddaje Najemcy w najem lokal mieszkalny pod adresem: <span class="b">${FLAT.join(", ")}</span>, o powierzchni 34 m², składający się z pokoju, aneksu kuchennego i łazienki.</p>
<p class="c b">§ 2. Okres najmu</p>
<p>Umowa zostaje zawarta na czas określony <span class="b">od dnia 1 października 2026 r. do dnia 30 września 2027 r.</span> Najemca zamieszkuje w lokalu od dnia 1 października 2026 r.</p>
<p class="c b">§ 3. Czynsz i opłaty</p>
<p>Czynsz najmu wynosi 2 900 zł miesięcznie, płatny z góry do 10. dnia każdego miesiąca. Opłaty za media rozliczane są według zużycia. Najemca wpłaca kaucję w wysokości 2 900 zł.</p>
<p class="c b">§ 4. Postanowienia końcowe</p>
<p>W sprawach nieuregulowanych stosuje się przepisy Kodeksu cywilnego. Umowę sporządzono w dwóch jednobrzmiących egzemplarzach, po jednym dla każdej ze stron.</p>
<div style="display:flex;justify-content:space-between;margin-top:90px"><span>Wynajmująca<br><i>Marta Kowalczyk</i></span><span class="r">Najemca<br><i>Arjun Raman</i></span></div>
${foot}</body></html>`;

const odciski = page("22.10.2026", `<h1>WEZWANIE</h1><h2>do osobistego stawiennictwa w celu pobrania odcisków linii papilarnych</h2>
<p>W związku z postępowaniem w sprawie udzielenia zezwolenia na pobyt czasowy w celu kontynuacji studiów, na podstawie art. 50 § 1 Kodeksu postępowania administracyjnego oraz przepisów ustawy z dnia 12 grudnia 2013 r. o cudzoziemcach dotyczących pobrania odcisków linii papilarnych, wzywam Pana do osobistego stawiennictwa:</p>
<p class="c b" style="font-size:33px">dnia 04.11.2026 r. o godz. 10:40<br>Wydział Spraw Cudzoziemców, ul. Marszałkowska 3/5, 00-624 Warszawa</p>
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

export const LETTERS = { "wezwanie-braki": braki, "wezwanie-zaswiadczenie": zaswiadczenie, "umowa-najmu": lease, "wezwanie-odciski": odciski, "zawiadomienie-36": art36, "decyzja-pozytywna": decyzja };
