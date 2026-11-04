import { Icon } from "@/components/Icon";
import { AgentOrb, Pill } from "@/components/ui";
import { GmailLogo, GoogleCalendarLogo } from "@/components/ui/logos";

/** Home, "your next step": the sample case's most urgent item with its countdown. Static sample content. */
export function HomeScreen() {
  return (
    <div className="dl-scr">
      <div className="dl-scr-head">
        <div>
          <span className="dl-scr-eyebrow">Wednesday 4 November</span>
          <p className="dl-scr-title">Good morning, Arjun</p>
        </div>
        <span className="dl-scr-av">AR</span>
      </div>

      <div className="dl-next">
        <div className="dl-next-top">
          <span className="dl-scr-eyebrow">Your next step</span>
          <Pill tone="warn" dot>Deadline</Pill>
        </div>
        <div className="dl-next-count">
          <b className="ui-display ui-num">8</b>
          <span>days left</span>
        </div>
        <p className="dl-next-title">Send the 3 documents the office asked for</p>
        <p className="dl-next-date">Due Thu 12 Nov · KPA art. 64 §2</p>
        <div className="dl-next-act">
          <span className="dl-mbtn dl-mbtn--ink">See how it’s counted <Icon name="forward" size={13} /></span>
          <span className="dl-mbtn"><Icon name="sparkle" size={13} /> Ask</span>
        </div>
      </div>

      <div className="dl-mlist">
        <div className="dl-mrow">
          <span className="dl-mrow-ic"><GoogleCalendarLogo size={15} /></span>
          <span><b>Fingerprints appointment</b><small>Thu 19 Nov · 10:30 · Marszałkowska 3/5</small></span>
        </div>
        <div className="dl-mrow">
          <span className="dl-mrow-ic"><GmailLogo size={15} /></span>
          <span><b>Letter from the Mazowiecki office</b><small>Read with Look · 3 documents asked for</small></span>
        </div>
      </div>

      <div className="dl-ask">
        <AgentOrb size={24} state="still" />
        <span>Ask about your case…</span>
        <Icon name="mic" size={15} />
      </div>
    </div>
  );
}
