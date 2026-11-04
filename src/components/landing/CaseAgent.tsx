import { Icon, type IconName } from "@/components/Icon";
import { AgentOrb } from "@/components/ui";
import { GmailLogo, GoogleCalendarLogo } from "@/components/ui/logos";

const FACTS: { label: string; value: string; source: string; icon: IconName | "gmail" | "gcal" }[] = [
  { label: "Application filed", value: "18 Sep 2026", source: "UPO receipt", icon: "file" },
  { label: "Summons: 3 documents", value: "Due 12 Nov", source: "Letter photo", icon: "scan" },
  { label: "Fingerprints", value: "19 Nov, 10:30", source: "Gmail", icon: "gmail" },
  { label: "University certificate", value: "In documents", source: "Your upload", icon: "attach" },
];

function SourceIcon({ icon }: { icon: (typeof FACTS)[number]["icon"] }) {
  if (icon === "gmail") return <GmailLogo size={12} />;
  if (icon === "gcal") return <GoogleCalendarLogo size={12} />;
  return <Icon name={icon} size={12} />;
}

/** The case file and a grounded answer, side by side: what "knows your case" means in practice. */
function CaseVisual() {
  return (
    <div className="dl-casevis" role="img" aria-label="Sample case file for Arjun Raman with four facts and their sources, and an answer to the question what do I still owe the office: two documents by 12 November.">
      <div className="dl-file" aria-hidden="true">
        <div className="dl-file-head">
          <span className="ui-eyebrow">Case file · sample</span>
          <p className="dl-file-name">Arjun Raman</p>
          <p className="dl-file-sub">Temporary residence for studies · Mazowiecki office, Warsaw</p>
          <p className="dl-file-no dl-mono">WSC-II-P.6151.48213.2026</p>
        </div>
        <ul className="dl-facts">
          {FACTS.map((f) => (
            <li key={f.label}>
              <span className="dl-fact-l">{f.label}</span>
              <span className="dl-fact-v">{f.value}</span>
              <span className="dl-fact-s"><SourceIcon icon={f.icon} />{f.source}</span>
            </li>
          ))}
        </ul>
      </div>
      <div className="dl-chat" aria-hidden="true">
        <p className="dl-bubble dl-bubble--you">What do I still owe the office?</p>
        <div className="dl-bubble dl-bubble--agent">
          <AgentOrb size={22} state="still" />
          <p>
            Two documents for the summons, by <b>Thu 12 Nov</b>: a rental agreement and proof of health insurance
            for your whole stay. Your passport copy is already in your documents.
          </p>
        </div>
        <span className="dl-talk"><Icon name="mic" size={16} /> Talk to Dossierly</span>
      </div>
    </div>
  );
}

/** "Knows your case": the personal agent with a server-side case file. */
export function CaseAgent() {
  return (
    <section id="agent" className="dl-sec" aria-labelledby="agent-h">
      <div className="dl-wrap dl-split dl-split--rev">
        <div className="dl-split-copy" data-reveal>
          <span className="ui-eyebrow">Your personal agent</span>
          <h2 id="agent-h" className="dl-h2">A translator knows the words. <em>Dossierly knows your case.</em></h2>
          <p className="dl-lead">
            Your case is kept as one structured file: permit, case number, documents, deadlines, appointments and
            tasks. Ask anything, typed or spoken, and the answer starts from your case, not from scratch.
          </p>
          <ul className="dl-points">
            <li><Icon name="home" size={18} /><span><b>Your next step, always first.</b> Home shows the one thing that matters most today.</span></li>
            <li><Icon name="link" size={18} /><span><b>Every fact has a source:</b> the letter, the email, or what was said at the counter.</span></li>
            <li><Icon name="mic" size={18} /><span><b>Speak in your language.</b> Talk to it by voice whenever you open the app.</span></li>
          </ul>
        </div>
        <div data-reveal><CaseVisual /></div>
      </div>
    </section>
  );
}
