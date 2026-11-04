import type { Metadata } from "next";

export const metadata: Metadata = { title: "Limitations", description: "What Dossierly cannot do, and where its privacy and accuracy end." };

const KNOWN = [
  { t: "Model calls leave your device", d: "Masked text is sent to Meta Muse models with storage off. Check Meta's current terms for how model inputs are handled." },
  { t: "Your agent sees plain text while it works", d: "Names, case numbers, PESEL and addresses are masked first, but the rest of the case is readable by your agent during a task." },
  { t: "The ledger is our own record", d: "We write the ledger and hash-chain it so changes are detectable. It lists the model calls and connections Dossierly itself makes." },
  { t: "Speech is transcribed by Muse Voice Transcribe", d: "In Polish, English and Ukrainian, each spoken turn is sent once for transcription, then deleted: no audio is stored. Hindi and Tamil use your browser's own recognition, and the spoken Polish voice is your browser's. Typing always works." },
  { t: "Deadlines need the right delivery date", d: "We count from the date you give us, using the rules quoted on the Poland page. The date written in your letter always wins. Check it." },
  { t: "Not legal or medical advice", d: "Dossierly interprets and explains. For advice, find a qualified lawyer (rejestradwokatow.pl) or a doctor." },
];

export default function LimitsPage() {
  return (
    <div className="doc-page">
      <span className="kicker">Published limitations</span>
      <h1>What Dossierly cannot do</h1>
      <p className="lead muted">We publish the limits we know about, with numbers where we have them.</p>
      <div className="stack" style={{ marginTop: 24 }}>
        <ul className="cov-list">
          {KNOWN.map((k) => (
            <li key={k.t} className="cov-item">
              <b>{k.t}</b>
              <p className="small muted" style={{ margin: "4px 0 0" }}>{k.d}</p>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
