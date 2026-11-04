import type { ReactNode } from "react";
import { Icon } from "@/components/Icon";
import { Pill } from "@/components/ui";
import { MetaMark } from "@/components/ui/logos";
import { LookScreen } from "./LookScreen";
import { Phone } from "./Phone";
import { CallScreen, CounterScreen } from "./VoiceScreens";

type Moment = {
  id: string;
  n: string;
  when: string;
  title: string;
  body: string;
  points: ReactNode[];
  credit: string;
  note?: ReactNode;
  phone: ReactNode;
  aside?: string;
};

const MOMENTS: Moment[] = [
  {
    id: "look",
    n: "01",
    when: "A letter arrives",
    title: "Point your phone at it. Know what it means.",
    body: "Photograph a letter or screenshot a MOS or inPOL screen. Dossierly outlines what matters on your own image, explains it in plain words and adds the facts to your case.",
    points: [
      <><b>Outlined, not guessed.</b> The case number, the deadline sentence and each document asked for, marked on the photo.</>,
      <><b>Checked against your case.</b> It knows which documents you already have and which are missing.</>,
      <><b>Paper or screen.</b> Letters from the office, and screenshots of MOS or inPOL when a field makes no sense.</>,
    ],
    credit: "Muse Spark 1.3 reads it · SAM 3.1 outlines it",
    phone: <Phone label="Look screen: a photo of the sample summons with the case number, the three requested documents and the 14-day deadline outlined, and an explanation listing one document in hand and two missing." tab="none"><LookScreen /></Phone>,
  },
  {
    id: "counter",
    n: "02",
    when: "At the office counter",
    title: "Lay the phone on the desk. Both of you are understood.",
    body: "Counter interprets voice to voice. The half facing the official speaks and shows Polish; your half shows your language. Because it knows your case, it does more than translate.",
    points: [
      <><b>Documents on request.</b> When the official asks for one, it opens on screen, turned toward them.</>,
      <><b>Nothing forgotten.</b> Requests and dates become tasks while you are still at the counter.</>,
      <><b>A coach, not a parrot.</b> When a literal translation would confuse, it suggests the question that fits your case.</>,
    ],
    credit: "Muse Voice Transcribe hears · Muse Spark translates · ElevenLabs speaks",
    aside: "This half faces the official",
    phone: <Phone label="Counter screen: the top half, turned toward the official, shows Polish and the university certificate; the bottom half shows the official's question in English and a task added for health insurance." tab="none"><CounterScreen /></Phone>,
  },
  {
    id: "call",
    n: "03",
    when: "When something new comes in",
    title: "It tells you first, and can even call.",
    body: "Connect Gmail and Google Calendar. Dossierly notices official mail, puts appointments and deadlines in your calendar, and can phone you to talk a new letter through.",
    points: [
      <><b>Read-only Gmail.</b> It reads official mail to build your case; it never sends email as you.</>,
      <><b>Your calendar, kept honest.</b> Appointments and deadline reminders land in Google Calendar.</>,
      <><b>Talk any time.</b> Open the app and speak to your caseworker; it already knows the case.</>,
    ],
    credit: "Muse Spark 1.3 thinks · ElevenLabs Flash speaks",
    note: <Pill tone="agent" icon="phone">Phone calls are coming soon · live on our demo account</Pill>,
    phone: <Phone label="A phone call from Dossierly about a new letter, with a caption: three documents are needed by Thursday the 12th and two are still missing." tab="none" tone="dark"><CallScreen /></Phone>,
  },
];

/** The three moments the product is built around, each beside its real screen. */
export function Moments() {
  return (
    <section id="how" className="dl-sec" aria-labelledby="how-h">
      <div className="dl-wrap">
        <header className="dl-head" data-reveal>
          <span className="ui-eyebrow">How it works</span>
          <h2 id="how-h" className="dl-h2">Built for the moments that <em>decide</em> your case</h2>
          <p className="dl-lead">A letter you can’t read. A counter where nobody speaks English. A date you didn’t know was running. Dossierly is there for each one.</p>
        </header>
        <div className="dl-moments">
          {MOMENTS.map((m, i) => (
            <article key={m.id} className={`dl-moment${i % 2 ? " dl-moment--flip" : ""}`} aria-labelledby={`m-${m.id}`}>
              <div className="dl-moment-copy" data-reveal>
                <p className="dl-moment-when"><span className="dl-mono">{m.n}</span>{m.when}</p>
                <h3 id={`m-${m.id}`} className="dl-moment-title">{m.title}</h3>
                <p className="dl-body">{m.body}</p>
                <ul className="dl-points">
                  {m.points.map((p, k) => <li key={k}><Icon name="check" size={18} /><span>{p}</span></li>)}
                </ul>
                {m.note}
                <p className="dl-credit"><MetaMark size={18} />{m.credit}</p>
              </div>
              <div className={`dl-moment-stage dl-moment-stage--${m.id}`} data-reveal>
                {m.aside && <span className="dl-aside" aria-hidden="true">{m.aside}</span>}
                {m.phone}
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
