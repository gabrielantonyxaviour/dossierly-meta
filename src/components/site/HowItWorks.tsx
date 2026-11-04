const STEPS = [
  {
    tag: "Before",
    title: "Prepare with sources",
    body: "Your agent reads the official pages for your office, checks them against your case and writes a checklist. Every line opens the paragraph it came from.",
    models: "Muse Spark",
  },
  {
    tag: "During",
    title: "Interpret at the desk",
    body: "Lay the phone flat between you; the official's half faces them. Two buttons, two languages, turns as cards. If a date or a yes/no could be misread, Dossierly speaks up with a ready question in Polish.",
    models: "Muse Spark · Muse Voice Transcribe",
  },
  {
    tag: "After",
    title: "A wrap-up in your case",
    body: "What was agreed, what to bring, which dates were named, what is still unclear. Saved encrypted on your phone, filed into your agent's memory, exported to your calendar.",
    models: "Muse Spark",
  },
  {
    tag: "Letters",
    title: "Read, link, reply",
    body: "Photograph the letter or upload the e-Doręczenia PDF. You get the exact Polish text beside the explanation, the link to what was said before, the deadline with every step of the count, and a Polish cover letter.",
    models: "SAM 3.1 vision · Muse Spark whole-case reasoning · deadline in code",
  },
];

export function HowItWorks() {
  return (
    <section className="section wrap" id="how" aria-labelledby="how-h">
      <div className="section-head">
        <span className="kicker">How it works</span>
        <h2 id="how-h">Before, during and after every visit to the office.</h2>
        <p>One case, one agent, from the first application to the card in your hand.</p>
      </div>
      <ol className="how-grid">
        {STEPS.map((s, i) => (
          <li key={s.tag} className="how-card">
            <span className="how-n mono">{String(i + 1).padStart(2, "0")} · {s.tag}</span>
            <h3>{s.title}</h3>
            <p className="small">{s.body}</p>
            <span className="how-models mono">{s.models}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}
