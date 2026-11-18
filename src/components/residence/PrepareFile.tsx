"use client";
import { useState } from "react";
import { Icon } from "@/components/Icon";
import { Button, cx, Pill } from "@/components/ui";
import { CHECKLIST, PERSON } from "./data";
import { Activity, Block, Fact, StatusLine } from "./parts";

/* Stage 1 · Prepare and stage 2 · File in MOS. Reference A: grouped checklist rows (Timeline-1 cards) and
   Agent Activity-1 for the filing walk-through, where only the person can sign and send. */

export function PrepareScreen() {
  const all = CHECKLIST.flatMap((g) => g.items);
  const done = all.filter((i) => i.state === "done").length;
  return (
    <div className="rp-screen">
      <p className="rp-eyebrow">Stage 1 of 7 · Prepare</p>
      <h1 className="rp-h1">Get everything ready</h1>
      <StatusLine word={`${done} of ${all.length} ready`} sub={`File by ${PERSON.fileBy}. 56 days left.`} pct={(done / all.length) * 100} left="Started 19 Nov" right="File by 14 Jan" />
      {CHECKLIST.map((g) => (
        <Block key={g.group} title={g.group} aside={<span className="ui-meta ui-num">{g.items.filter((i) => i.state === "done").length}/{g.items.length}</span>}>
          <ul className="rp-check">
            {g.items.map((it) => (
              <li key={it.title} className={cx("rp-check-row", `is-${it.state}`)}>
                <span className="rp-check-mark" aria-hidden="true">{it.state === "done" ? <Icon name="check" size={14} /> : it.state === "warn" ? <Icon name="alert" size={14} /> : null}</span>
                <span className="rp-check-main"><b>{it.title}</b><span>{it.sub}</span></span>
                {it.who && <Pill tone="warn">Waiting on {it.who}</Pill>}
                {it.state === "todo" && <span className="rp-check-cta">Add</span>}
              </li>
            ))}
          </ul>
        </Block>
      ))}
      <p className="rp-note">Dossierly checks each document as it arrives. It never signs or sends anything for you.</p>
    </div>
  );
}

const MOS_STEPS = [
  { title: "Sign in to MOS with Profil Zaufany", sub: "mos.cudzoziemcy.gov.pl" },
  { title: "Copy the answers from your field sheet", sub: "Every field prefilled from your case, in Polish" },
  { title: "Attach 7 files", sub: "Photo, passport PDF, insurance, lease, contract, both fee receipts" },
  { title: "Check the employer annex arrived", sub: "MOS shows it once HR signs" },
  { title: "Sign and send", sub: "Only you can do this" },
];

export function FileScreen() {
  const [upo, setUpo] = useState(false);
  return (
    <div className="rp-screen">
      <p className="rp-eyebrow">Stage 2 of 7 · File in MOS</p>
      <h1 className="rp-h1">Send your application</h1>
      <p className="rp-lead">Since 27 April 2026 applications go only through MOS, online. You file it yourself; Dossierly walks you through every screen.</p>
      <Activity
        title="Filing walk-through"
        badge={<Pill tone={upo ? "ok" : "warn"}>{upo ? "Filed" : "In progress"}</Pill>}
        steps={MOS_STEPS.map((s, i) => ({
          ...s,
          state: upo || i < 3 ? "done" : i === 3 ? "now" : "you",
          tag: !upo && i === 4 ? { tone: "warn", text: "Only you" } : undefined,
        }))}
        foot={<span className="ui-meta">Step {upo ? 5 : 4} of 5</span>}
      />
      <Block title="Your receipt">
        {upo ? (
          <div className="rp-stack">
            <Fact icon="check" tone="ok" title="UPO receipt saved" sub={`Filed ${PERSON.filed}. This is your proof of filing on time.`} />
            <Fact icon="file" title={`Case number ${PERSON.caseNo}`} sub="Emailed by the office; saved to your case" />
          </div>
        ) : (
          <>
            <p className="rp-lead">MOS does not email a confirmation. Download the UPO after sending and add it here: without it, the application does not count as filed.</p>
            <Button variant="primary" icon="attach" block onClick={() => setUpo(true)}>Add my UPO receipt</Button>
          </>
        )}
      </Block>
    </div>
  );
}
