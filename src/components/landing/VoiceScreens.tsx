import { Icon } from "@/components/Icon";
import { AgentOrb } from "@/components/ui";

/** Counter: phone flat on the desk. The top half is turned to face the official (Polish); the bottom half is yours. */
export function CounterScreen() {
  return (
    <div className="dl-ct">
      <div className="dl-ct-half dl-ct-off">
        <div className="dl-ct-flip">
          <span className="dl-ct-lab"><b>Polski</b> for the official</span>
          <p className="dl-ct-big">Tak, mam. Zaświadczenie jest na ekranie.</p>
          <div className="dl-ct-doc dl-ct-doc--off">
            <Icon name="file" size={14} />
            <span><b>Zaświadczenie z uczelni</b><small>Shown from Arjun’s documents</small></span>
          </div>
        </div>
      </div>
      <div className="dl-ct-bar">
        <AgentOrb size={20} state="live" />
        <span>Listening to both of you</span>
        <span className="dl-ct-time ui-num">04:12</span>
      </div>
      <div className="dl-ct-half dl-ct-you">
        <span className="dl-ct-lab"><b>English</b> for you</span>
        <p className="dl-ct-heard"><small>The official asked</small>Do you have the certificate from your university?</p>
        <p className="dl-ct-said"><small>You said</small>Yes, I have it.</p>
        <div className="dl-ct-task">
          <Icon name="task" size={14} />
          <span><b>Task added</b><small>Bring proof of health insurance by Thu 12 Nov</small></span>
        </div>
      </div>
    </div>
  );
}

/** A phone call from Dossierly about a new letter, with the live caption of what it is saying. */
export function CallScreen() {
  return (
    <div className="dl-call">
      <span className="dl-call-sub">About a new letter</span>
      <AgentOrb size={92} state="live" />
      <p className="dl-call-name">Dossierly</p>
      <p className="dl-call-time ui-num">00:21</p>
      <div className="dl-call-cap">
        <small>Dossierly</small>
        “Hi Arjun. A letter from the Mazowiecki office just arrived in your Gmail. They need three documents by
        Thursday the 12th, and two are still missing. Shall I walk you through them?”
      </div>
      <div className="dl-call-btns">
        <span><Icon name="mic" size={18} /></span>
        <span><Icon name="speak" size={18} /></span>
        <span className="is-end"><Icon name="phone" size={18} /></span>
      </div>
    </div>
  );
}
