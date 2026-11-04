import { FACT_KEYS } from "../case/types";
import { ITEM_ROLES, LOOK_KINDS } from "./types";

const str = { type: "string" };
const nullableStr = { type: ["string", "null"] };

/** response_format json_schema for the single Spark read+ground call. */
export const READ_JSON_SCHEMA: Record<string, unknown> = {
  type: "object",
  properties: {
    kind: { type: "string", enum: [...LOOK_KINDS] },
    readable: { type: "boolean" },
    title: str,
    summary: str,
    actions: { type: "array", items: str },
    items: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: str,
          role: { type: "string", enum: [...ITEM_ROLES] },
          label: str,
          text: str,
          meaning: str,
          value: nullableStr,
        },
        required: ["id", "role", "label", "text", "meaning"],
      },
    },
    facts: {
      type: "object",
      properties: Object.fromEntries(FACT_KEYS.map((k) => [k, nullableStr])),
    },
    letter: {
      type: ["object", "null"],
      properties: {
        dateOnLetter: nullableStr,
        asks: { type: "array", items: str },
        asksLocal: { type: "array", items: str },
        deadlineRule: {
          type: "object",
          properties: {
            amount: { type: ["integer", "null"] },
            unit: { type: ["string", "null"], enum: ["days", "weeks", "months", null] },
            from: { type: ["string", "null"], enum: ["delivery", "letter_date", null] },
            quote: str,
          },
          required: ["amount", "unit", "from", "quote"],
        },
        legalBasis: nullableStr,
      },
      required: ["dateOnLetter", "asks", "asksLocal", "deadlineRule", "legalBasis"],
    },
    uncertain: { type: "array", items: str },
  },
  required: ["kind", "readable", "title", "summary", "actions", "items", "facts", "letter", "uncertain"],
};

const SCHEMA_TEXT = `{"kind": "letter"|"decision"|"mos_screen"|"upo"|"inpol_status"|"kiosk"|"other", "readable": boolean, "title": string, "summary": string, "actions": string[], "items": [{"id": "i1", "role": ${ITEM_ROLES.map((r) => `"${r}"`).join("|")}, "label": string, "text": string, "meaning": string, "value": string|null}], "facts": {${FACT_KEYS.map((k) => `"${k}": string|null`).join(", ")}}, "letter": null | {"dateOnLetter": "YYYY-MM-DD"|null, "asks": string[], "asksLocal": string[], "deadlineRule": {"amount": int|null, "unit": "days"|"weeks"|"months"|null, "from": "delivery"|"letter_date"|null, "quote": string}, "legalBasis": string|null}, "uncertain": string[]}`;

/** Call 1 (grounding): where every line of text is. Kept separate and minimal: boxes get worse when it shares a call with reading. */
export const LINES_SYSTEM = `You are an object grounding expert. Transcribe the document line by line, top to bottom. Every physical line of printed text is one entry, in reading order, numbered from 1, with a tight bounding box around exactly that line in normalized 0-1000 coordinates relative to the whole image (0,0 is the top-left corner; x is the fraction of the image width, y the fraction of the image height, 1000 is the far edge). A paragraph that wraps over three lines is three entries. On a screen, every label, form field (also an empty one: text ""), button, status line and heading is one entry. The page may be a tilted, shadowed phone photo: lines then slope slightly, still give the axis-aligned box covering the whole line from its first to its last character, never cutting a word. Copy the text verbatim, Polish diacritics kept; do not do anything else. At most 70 entries. Do not miss any objects; if you cannot find one, omit it. JSON only: {"lines":[{"n":int,"text":string,"bbox":{"x_min":int,"y_min":int,"x_max":int,"y_max":int}}]}`;

/** Call 2 (reading): meaning and structure, no coordinates. Items are matched to the grounded lines by their verbatim text. */
export const READ_SYSTEM = `You read one photo or screenshot that a newcomer to Poland (non-EU, temporary residence permit) shows their caseworker, and pick out the important items. Never invent text that is not on the image.

READING RULES. Copy numbers, dates, case numbers, amounts and names exactly as printed, character for character, Polish diacritics kept, never normalised or guessed. Each item's "text" is the verbatim printed text of that item (the whole sentence or line, as printed, wraps joined with a space). If a character or number is not clearly legible, still give your best reading but add that item id or fact key to "uncertain". If the image is not an official document or screen, or is unreadable, set readable=false, kind="other", put a short plain explanation in "title" and "summary", and return no items.

WHAT TO PICK, by kind (max 8 items in total; up to 12 on a MOS form):
- letter / decision (a printed Polish official letter): (1) role "deadline": the sentence that sets the deadline (a phrase such as "w terminie N dni od dnia doręczenia niniejszego wezwania"; read N from the image), the whole sentence; (2) role "case_number": the line with the case number (znak sprawy / sygn. akt), label included; (3) role "date": the date and place line of the letter; (4) role "documents": the requested documents, one item per numbered or bulleted entry when they are separate lines, otherwise one item for the whole list; (5) role "office": the line with the office name in the header only (not the address lines below it). Order items by importance: deadline first.
- mos_screen (the Polish MOS online application form): one item per visible form field, role "field"; "text" is the field's label as printed. Set "value" to what the user should type or choose there, taken ONLY from the CASE CONTEXT; null when the case does not contain it. Never invent a value.
- upo (official confirmation of receipt): the case or reference number (role "case_number") and the filing or receipt date (role "date").
- inpol_status (a status page): the status line (role "status") and any date (role "date").
- kiosk (a queue-ticket machine): the single button the user should press for their purpose or question (role "button"), then 1-2 alternatives (role "button"), with "meaning" saying when each fits. "text" is the button label as printed. State the chosen one first in "actions".
For anything else, pick at most 3 clearly important items with role "other".

OTHER FIELDS. "label": a 2-4 word name in plain English ("Your deadline", "Case number"). "meaning": one plain-English sentence for a non-native reader, explaining only what the text says. "title": what the document is, e.g. "Summons to complete missing documents". "summary": 2-3 plain-English sentences: what this is and why it matters. "actions": the ordered things the user should do next, imperative, plain English, max 5, based only on what is printed or visible. "facts": only the keys you actually read from the image (${FACT_KEYS.join(", ")}); null for the rest; Polish diacritics kept; dates (filedAt, upoReceivedAt) as YYYY-MM-DD without a time. "letter": for letter/decision kinds only (null otherwise): dateOnLetter as YYYY-MM-DD; "asks" the requested documents or actions in plain English and "asksLocal" the same in the verbatim Polish, same order; deadlineRule.amount/unit give the period exactly as printed (e.g. "14 dni": amount 14, unit "days"), "from" is "delivery" when counted from receipt/delivery of the letter and "letter_date" when counted from the date of the letter, "quote" the verbatim Polish sentence; legalBasis the legal provision printed on the letter, abbreviating the Code of Administrative Procedure as KPA, e.g. "art. 64 § 2 KPA", else null. Item ids are "i1", "i2", ... in the order you list the items; "uncertain" holds item ids and fact keys.

Reply with one JSON object only, matching this schema: ${SCHEMA_TEXT}`;
