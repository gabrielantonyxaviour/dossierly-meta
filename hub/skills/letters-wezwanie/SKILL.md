---
name: letters-wezwanie
description: Turn a read official letter (wezwanie, decision, card-collection notice, notice of delay) into a checklist of what the person is asked to provide, which channel to use, the statutory minimum term and the fee facts, with citations. Use after a letter has been read, when the person asks "what does this letter want" or "what do I need to send".
---

# Letters from the office (wezwanie and related)

## When to use
- A letter was read (`letter.kind`, `asks[]`, `deadlineRule`) and the person needs an organised list of items and phrases.
- Letter types in `coverage.json`: `wezwanie-braki-formalne`, `wezwanie-dokumenty`, `fingerprint-appointment`, `wezwanie-oplata`, `decyzja`, `karta-odbior`, `zawiadomienie-przedluzenie`.

## Inputs you get
- `letter` JSON, `deliveryDate` if the person gave it, `case` JSON, `appointment` if any.
- Hub passages with citations. Cite only these or the seed table below.

## Steps
1. Match the letter to one `letterTypes` id. If none fits, use status `check` for everything and say the type is unknown.
2. For each ask in `letter.asks`, write one checklist item in plain English. Status: `have` if `case.documents` shows it, `missing` if the case shows it absent, else `check`.
3. Three different summonses, never mixed:
   | Summons | Basis | Minimum | If missed |
   |---|---|---|---|
   | Formal defect (`wezwanie-braki-formalne`) | KPA art. 64 §2 | at least 7 days | application left without consideration (pozostawienie bez rozpoznania) |
   | Evidence documents (`wezwanie-dokumenty`) | Ustawa o cudzoziemcach art. 106f | at least 14 days from delivery | the 60-day decision period starts when the period lapses unused (art. 112a ust. 2 pkt 3); claim nothing more |
   | Personal appearance: fingerprints, passport, signature (`fingerprint-appointment`) | art. 106e ust. 1 | at least 7 days from delivery | the proceedings are discontinued (umorzenie, art. 106i), NOT left without consideration |
   They can arrive in one letter (art. 106e ust. 2). State the consequence of the matching row only.
   Deadline facts for the caller's code (never compute the date yourself): copy the letter's own written term first, then the hub minimum (`wezwanie-braki-formalne` 7 days, `wezwanie-dokumenty` 14 days, `fingerprint-appointment` 7 days, `decyzja` appeal 14 days, all from delivery). The date in the letter governs; the hub figure is only a minimum. If `deliveryDate` is missing, add a `check` item: "Date the letter was delivered (needed to count the term)".
4. Channel: for MOS cases the office works electronically. Add the item "Send by e-Doręczenia, title: case number, name" and "Do not also post the same papers" with their citations. Say that scans of paper originals must be electronically certified (notary, or an attorney-in-fact who is a lawyer) only if the letter asks for documents.
5. Fees: if the letter asks for payment, look up `coverage.json` fees. State amount and account from the hub, flag that permit fee and card fee use different accounts, and add `check` "Confirm the amount on the letter matches the live fee page".
6. Decision letters: say what the letter states (grant/refusal) from the letter text only. For a refusal add the item "Appeal period: 14 days from delivery, filed through the Wojewoda Mazowiecki on paper or by e-Doręczenia (never through MOS)" with citation. No advice on whether to appeal.
6a. Delay: never present an office as "overdue" or late as a legal fact. The 60-day decision period (art. 112a) does not run until after 4 March 2027 (art. 100d of the Act of 12 March 2022, Dz.U. 2026 poz. 203). If the person asks about delay, say that and stop.
7. Card-collection notice: item "Come on the date and place in the notice"; no collection deadline was found in the sources: mark `check`.
8. Phrases: 4-6 from `hub/phrases/pl.json` situation `letter-wezwanie`, plus `understanding`.
9. `changes`: hub notices newer than the letter date that concern the same topic.

## Output
```json
{"checklist":[{"item":"Proof of health insurance","status":"have|missing|check","citation":{"url":"https://...","title":"...","quote":"..."}}],
 "phrases":[{"local":"Do kiedy mam dostarczyć dokumenty?","user":"By what date do I have to deliver the documents?"}],
 "changes":[{"title":"...","summary":"...","url":"https://...","detectedAt":"YYYY-MM-DD"}]}
```
Return JSON only.

## Rules
- Interpret only. No legal advice, no "you should", no predicting outcomes.
- Cite hub passages only. Without a hub citation, status is `check`, `"citation": null`, and the item is a question for the office.
- Never invent a deadline, fee, account number or document. Never turn "at least N days" into "exactly N days".
- Delivery: e-Doręczenia not collected counts as delivered on the day after 14 days from arrival (art. 42 of the Act on electronic delivery); post with a notice follows KPA art. 44 (14 days' storage). Leave the arithmetic to the caller.
- Terms count in calendar days unless the letter says otherwise (KPA art. 57). Leave arithmetic to the caller.

## Seed passages (verified 2026-10-30)
| id | url | quote |
|---|---|---|
| kpa-64 | https://api.sejm.gov.pl/eli/acts/DU/2025/1691/text.pdf | należy wezwać wnoszącego do usunięcia braków w wyznaczonym terminie, nie krótszym niż siedem dni, z pouczeniem, że nieusunięcie tych braków spowoduje pozostawienie podania bez rozpoznania. |
| docs-14 | https://api.sejm.gov.pl/eli/acts/DU/2025/1794/text.pdf | w terminie nie krótszym niż 14 dni od dnia doręczenia wezwania. Określając termin, wojewoda ocenia czas niezbędny do uzyskania przez cudzoziemca określonego dokumentu. |
| together | https://api.sejm.gov.pl/eli/acts/DU/2025/1794/text.pdf | może nastąpić jednocześnie z wezwaniem do uzupełnienia braków formalnych wniosku o udzielenie zezwolenia na pobyt czasowy na podstawie art. 64 § 2 |
| count | https://api.sejm.gov.pl/eli/acts/DU/2025/1691/text.pdf | przy obliczaniu tego terminu nie uwzględnia się dnia, w którym zdarzenie nastąpiło. Upływ ostatniego z wyznaczonej liczby dni uważa się za koniec terminu. |
| letter-governs | https://migrant.wsc.mazowieckie.pl/pl/komunikaty/przerwa-w-dostepie-do-systemu-pobyt-do-4-maja-2026-r-wlacznie-nie-zlozysz-odciskow-linii | Pamiętaj, że termin na uzupełnienie braków formalnych wskazany w wezwaniu jest obowiązujący! |
| channel | https://migrant.wsc.mazowieckie.pl/pl/komunikaty/wyslales-dokumenty-do-swojej-sprawy-elektronicznie-przez-e-doreczenia-nie-wysylaj-tych | Uzupełnienie dokumentów do sprawy. numer sprawy, imię i nazwisko. |
| no-dup | https://migrant.wsc.mazowieckie.pl/pl/komunikaty/wyslales-dokumenty-do-swojej-sprawy-elektronicznie-przez-e-doreczenia-nie-wysylaj-tych | Dublowanie wysyłanej korespondencji nie przyśpieszy procedowania Twojej sprawy |
| certify | https://migrant.wsc.mazowieckie.pl/pl/procedury/zezwolenie-na-pobyt-czasowy-w-celu-wykonywania-pracy | Papierowe oryginały dokumentów muszą być wcześniej potwierdzone elektronicznie za zgodność z oryginałem przez notariusza |
| fee-440 | https://migrant.wsc.mazowieckie.pl/wskazowki/oplaty | Zezwolenie na pobyt czasowy i pracę 440 zł |
| fee-340 | https://migrant.wsc.mazowieckie.pl/wskazowki/oplaty | Zezwolenie na pobyt czasowy (pozostałe przypadki - w tym tzw. karta pobytu CUKR) 340 zł |
| appeal | https://migrant.wsc.mazowieckie.pl/pl/procedury/zezwolenie-na-pobyt-czasowy-w-celu-wykonywania-pracy | Odwołanie wnosisz za pośrednictwem Wojewody Mazowieckiego, w terminie 14 dni od dnia doręczenia decyzji. |
| delay | https://api.sejm.gov.pl/eli/acts/DU/2025/1691/text.pdf | zawiadomić strony, podając przyczyny zwłoki, wskazując nowy termin załatwienia sprawy oraz pouczając o prawie do wniesienia ponaglenia |
| collect | https://migrant.wsc.mazowieckie.pl/pl/procedury/zezwolenie-na-pobyt-czasowy-w-celu-wykonywania-pracy | Oczekuj na wiadomość SMS lub pismo nadane przez e-Doręczenia z terminem odbioru decyzji i karty |
