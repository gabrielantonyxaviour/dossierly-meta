import { Icon } from "@/components/Icon";
import { Pill } from "@/components/ui";

/* The sample summons: collected Wed 28 Oct 2026, 14 days, day 14 is Independence Day (Wed 11 Nov), so it is due Thu 12 Nov. */
const STEPS = [
  { tag: "Delivered", day: "Wed 28 Oct", text: "Arjun collected the letter at the post office and confirmed the date.", cite: "Your confirmation" },
  { tag: "Day 1", day: "Thu 29 Oct", text: "Counting starts on the day after delivery.", cite: "KPA art. 57 §1" },
  { tag: "Day 14", day: "Wed 11 Nov", text: "Falls on Independence Day, a public holiday in Poland.", cite: "Public Holidays Act 1951" },
  { tag: "Due", day: "Thu 12 Nov", text: "A deadline ending on a holiday or a Saturday moves to the next working day.", cite: "KPA art. 57 §4" },
];

type Cell = { d: number; kind: "out" | "delivered" | "count" | "holiday" | "due"; weekend: boolean };
/** Mon 26 Oct to Sun 15 Nov 2026, three weeks. */
const CELLS: Cell[] = Array.from({ length: 21 }, (_, i) => {
  const date = new Date(Date.UTC(2026, 9, 26 + i));
  const d = date.getUTCDate();
  const m = date.getUTCMonth();
  const key = m * 100 + d;
  const kind: Cell["kind"] =
    key === 928 ? "delivered" : key === 1011 ? "holiday" : key === 1012 ? "due" : key > 928 && key < 1011 ? "count" : "out";
  return { d, kind, weekend: i % 7 >= 5 };
});

function MiniCalendar() {
  return (
    <div className="dl-cal" role="img" aria-label="Calendar from 26 October to 15 November 2026: delivered 28 October, 14 counted days to 11 November, a public holiday, so the deadline is 12 November.">
      <div className="dl-cal-grid" aria-hidden="true">
        {["M", "T", "W", "T", "F", "S", "S"].map((w, i) => <span key={i} className="dl-cal-w">{w}</span>)}
        {CELLS.map((c, i) => (
          <span key={i} className={`dl-cal-d is-${c.kind}${c.weekend ? " is-we" : ""}`}>{c.d}</span>
        ))}
      </div>
      <div className="dl-cal-key" aria-hidden="true">
        <span><i className="k-del" />Delivered</span>
        <span><i className="k-count" />Counted</span>
        <span><i className="k-hol" />Holiday</span>
        <span><i className="k-due" />Due</span>
      </div>
    </div>
  );
}

/** How a deadline is counted: the sample summons, step by step, with the article behind each step. */
export function Deadline() {
  return (
    <section id="deadlines" className="dl-sec dl-sec--band" aria-labelledby="dl-h">
      <div className="dl-wrap dl-split">
        <div className="dl-split-copy" data-reveal>
          <span className="ui-eyebrow">The deadline engine</span>
          <h2 id="dl-h" className="dl-h2">Counted the way <em>Polish law</em> counts</h2>
          <p className="dl-lead">
            A summons gives you a number of days from delivery. Dossierly does the counting in code, not by guessing:
            the day after delivery, weekends, Polish public holidays, and the letter you never collected.
          </p>
          <ul className="dl-points">
            <li><Icon name="scale" size={18} /><span><b>Every step shown,</b> with the article of the Code of Administrative Procedure (KPA) behind it.</span></li>
            <li><Icon name="letter" size={18} /><span><b>Never collected?</b> A letter left at the post office counts as delivered on the 14th day after the first notice (art. 44). It counts from there.</span></li>
            <li><Icon name="clock" size={18} /><span><b>Posted on the last day is on time</b> when you send it through Poczta Polska (art. 57 §5).</span></li>
          </ul>
          <p className="dl-fine">You confirm the delivery date. The date written in your letter always wins over our count.</p>
        </div>

        <div className="dl-calc" data-reveal>
          <div className="dl-calc-head">
            <div>
              <span className="ui-eyebrow">Summons · 14 days from delivery</span>
              <p className="dl-calc-due ui-display">Due Thu 12 Nov 2026</p>
            </div>
            <Pill tone="outline">Sample</Pill>
          </div>
          <ol className="dl-steps">
            {STEPS.map((s) => (
              <li key={s.tag} className={s.tag === "Due" ? "is-due" : undefined}>
                <span className="dl-step-tag">{s.tag}</span>
                <div>
                  <p className="dl-step-day">{s.day}</p>
                  <p className="dl-step-text">{s.text}</p>
                </div>
                <span className="dl-step-cite">{s.cite}</span>
              </li>
            ))}
          </ol>
          <MiniCalendar />
        </div>
      </div>
    </section>
  );
}
