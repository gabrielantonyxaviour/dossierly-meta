---
name: residence-card-fingerprints
description: Build the "what to have and bring" checklist and office phrases for a fingerprint / signature-specimen appointment, or for the card-collection visit, in a Mazowieckie temporary residence and work permit case. Use when the user has an appointment at the Wydział Spraw Cudzoziemców (office), a wezwanie to appear in person, or asks what happens after filing in MOS.
---

# Residence card and fingerprints (Mazowieckie)

## When to use
- Appointment purpose is fingerprints, signature specimen, passport check, or card collection.
- A letter or e-Doręczenia message calls the person to appear in person.
- Not for letters about missing documents: use `letters-wezwanie`.

## Inputs you get
- `appointment {office, purpose, date}`.
- `case` JSON (events, documents with `have`, deadlines).
- Hub passages with citations (url, title, quote). Cite only these or the seed table below.

## Steps
1. Read `appointment.purpose` and the case events. Decide the visit: fingerprints/signature (art. 106e), repeat fingerprints (art. 106g), or card collection.
2. Fingerprint visit checklist. Mark each `have` only if the case `documents` or events say so, `missing` if the case shows it absent, otherwise `check`:
   - the summons / appointment notice (it names the date and one of 4 Warsaw locations);
   - the original passport (the voivode calls the person to show it);
   - the UPO or filing certificate (zaświadczenie) from MOS;
   - proof that the permit fee and the 100 zł card fee were paid, if the case asks for it;
   - an active e-Doręczenia mailbox (notices and missing documents travel there).
2a. Consequence of missing the fingerprint summons: the proceedings are discontinued (umorzenie, art. 106i ust. 1), NOT "left without consideration" (that is the consequence of an unfixed formal defect, KPA art. 64 §2, a different summons). If the office cannot take prints on the day (art. 106g), it sets a new date at least 7 days from delivery. State this as a fact from the statute; never as advice.
3. Add one `check` item: "Documents are not accepted at the counter; send them by e-Doręczenia" with its citation. Never tell the person to bring paper documents to hand over.
4. If the case shows a child under 6, or a medical certificate on file, add a `check` item for the fingerprint exemption (art. 106b ust. 2). Do not decide eligibility.
5. Card collection visit: the office announces date and place by e-mail, SMS or e-Doręczenia. Checklist: the notice, the passport. Fees are not paid at collection by any source read: mark `check`.
6. Fees, if the person asks: amounts and accounts come only from `coverage.json` fees. 440 zł is the combined permit, 340 zł other temporary residence, 100 zł the card.
7. Add 4-6 phrases from `hub/phrases/pl.json` situations `office-fingerprints`, `office-certificate`, `understanding`. Put the Polish in `local`, the person's language in `user`.
8. `changes`: list hub notices dated after the case's last event that touch fingerprints, appointments, MOS or e-Doręczenia (title, summary, url, detectedAt).

## Output
```json
{"checklist":[{"item":"Original passport","status":"have|missing|check","citation":{"url":"https://...","title":"...","quote":"..."}}],
 "phrases":[{"local":"Proszę mówić wolniej.","user":"Please speak slowly."}],
 "changes":[{"title":"...","summary":"...","url":"https://...","detectedAt":"YYYY-MM-DD"}]}
```
Return JSON only.

## Rules
- Interpret and organise; no legal advice. Never say what the person "should" do about a deadline or refusal.
- Cite hub passages only. Every item has a real hub URL with a quote, or status `check` and `"citation": null` with the item written as a question to ask the office.
- Never invent a document, fee, date or office rule. If the summons does not say the location, say so.
- Never call the office "overdue" as a legal fact: the 60-day decision period (art. 112a) does not run until after 4 March 2027 (art. 100d of the Act of 12 March 2022, Dz.U. 2026 poz. 203).
- The summons date governs. Statute minimum: at least 7 days from delivery (art. 106e ust. 1). Do not compute the date yourself.

## Seed passages (verified 2026-10-30)
| id | url | quote |
|---|---|---|
| appear | https://migrant.wsc.mazowieckie.pl/pl/procedury/zezwolenie-na-pobyt-czasowy-w-celu-wykonywania-pracy | Wojewoda prowadzący sprawę wezwie Cię do osobistego stawiennictwa, abyś złożył odciski palców i wzór podpisu oraz okazał oryginał paszportu |
| no-paper | https://migrant.wsc.mazowieckie.pl/pl/procedury/zezwolenie-na-pobyt-czasowy-w-celu-wykonywania-pracy | Na stanowiskach obsługi klienta w urzędzie będziemy wyłącznie pobierać odciski linii papilarnych i weryfikować paszport. |
| location | https://migrant.wsc.mazowieckie.pl/faq | Urząd, za pośrednictwem e-mail, będzie wyznaczał termin i jedną z 4 lokalizacji (Warszawa: Marszałkowska 3/5, Aleje Jerozolimskie 28, Plac Bankowy 3/5, Krucza 5/11) |
| mailbox | https://migrant.wsc.mazowieckie.pl/pl/komunikaty/zaloz-konto-do-e-doreczen-niezbedne-do-doreczania-pism-i-komunikacji-z-nami | do otrzymywania wezwań, informacji o terminach osobistego stawiennictwa w celu pobrania odcisków palców czy informacji o terminie odbioru karty pobytu |
| min-days | https://api.sejm.gov.pl/eli/acts/DU/2025/1794/text.pdf | wojewoda wzywa cudzoziemca do osobistego stawiennictwa w terminie nie krótszym niż 7 dni od dnia doręczenia wezwania w celu: |
| repeat | https://api.sejm.gov.pl/eli/acts/DU/2025/1794/text.pdf | wojewoda wyznacza termin na ich złożenie nie krótszy niż 7 dni od dnia doręczenia wezwania. |
| fees | https://migrant.wsc.mazowieckie.pl/wskazowki/oplaty | Wydanie lub wymiana karty pobytu (w tym tzw. karta pobytu CUKR - dotyczy dorosłych i dzieci) 100 zł |
| upo | https://migrant.wsc.mazowieckie.pl/pl/procedury/zezwolenie-na-pobyt-czasowy-w-celu-wykonywania-pracy | Pobierz i zachowaj UPO (urzędowe poświadczenie otrzymania wniosku przez właściwy organ). |
| cert | https://migrant.wsc.mazowieckie.pl/pl/komunikaty/potwierdzenie-legalnego-pobytu-rozwiazanie-odpowiadajace-funkcji-stempla-w-paszporcie | Samo zaświadczenie nie zastępuje dokumentu podróży ani karty pobytu |
| collect | https://migrant.wsc.mazowieckie.pl/pl/procedury/zezwolenie-na-pobyt-czasowy-w-celu-wykonywania-pracy | Po wydaniu zezwolenia, urząd za pośrednictwem e-maila bądź e-Doręczeń wyśle do ciebie informację o wyznaczonym terminie i miejscu odbioru karty pobytu. |
| exempt | https://api.sejm.gov.pl/eli/acts/DU/2025/1794/text.pdf | Nie pobiera się odcisków linii papilarnych od cudzoziemca ubiegającego się o udzielenie zezwolenia na pobyt czasowy: 1) który do dnia złożenia wniosku |
