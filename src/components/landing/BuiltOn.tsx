import { ElevenLabsMark, MetaMark } from "@/components/ui/logos";

const MODELS: { name: string; role: string; body: string; maker: "meta" | "eleven" }[] = [
  {
    name: "Muse Spark 1.3",
    role: "The caseworker’s mind",
    body: "Runs your agent. It reasons over your case file, reads letters and screens and points at what matters, plans visits with web search, and coaches you at the counter.",
    maker: "meta",
  },
  {
    name: "Muse Spark 1.2",
    role: "Fast turns",
    body: "Translates each turn at the counter quickly, and checks that every answer stays an explanation rather than legal advice.",
    maker: "meta",
  },
  {
    name: "SAM 3.1",
    role: "Exact outlines",
    body: "Turns “the deadline is here” into a precise outline on your own photo, so you see exactly which line Dossierly means.",
    maker: "meta",
  },
  {
    name: "Muse Voice Transcribe",
    role: "Hears both sides",
    body: "Real-time speech to text with turn detection, primed with the words in your case, such as your case number and the documents you hold.",
    maker: "meta",
  },
  {
    name: "ElevenLabs Flash",
    role: "A natural voice",
    body: "Speaks the translation to the official in Polish and the answers to you in your language, with very little delay.",
    maker: "eleven",
  },
];

/** What each model does inside Dossierly. */
export function BuiltOn() {
  return (
    <section id="meta" className="dl-sec dl-sec--band" aria-labelledby="meta-h">
      <div className="dl-wrap">
        <header className="dl-head dl-head--c" data-reveal>
          <span className="dl-meta-badge"><MetaMark size={26} /> Built on Meta Muse</span>
          <h2 id="meta-h" className="dl-h2">Four Meta models, <em>one caseworker</em></h2>
          <p className="dl-lead">Each model does one job it is good at. Your agent ties them together around your case.</p>
        </header>
        <ul className="dl-models">
          {MODELS.map((m) => (
            <li key={m.name} className={`dl-model dl-model--${m.maker}`} data-reveal>
              <span className="dl-model-mark">{m.maker === "meta" ? <MetaMark size={22} /> : <ElevenLabsMark size={20} />}</span>
              <p className="dl-model-role">{m.role}</p>
              <h3 className="dl-model-name">{m.name}</h3>
              <p className="dl-body">{m.body}</p>
            </li>
          ))}
        </ul>
        <p className="dl-fine dl-models-note">
          Public data, read live: the Ministry of Finance VAT whitelist and the KRS register for employer checks.
          Model keys stay on our server; your browser never holds them.
        </p>
      </div>
    </section>
  );
}
