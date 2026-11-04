"use client";
import { useState } from "react";
import { BottomSheet, Button, MobileFlowHeader, MobilePage, OptionGrid, OptionList, ScreenTitle, StickyActionBar } from "@/components/ui";

const LANGS = [
  { value: "en", label: "English", sub: "English" },
  { value: "pl", label: "Polski", sub: "Polish" },
  { value: "uk", label: "Українська", sub: "Ukrainian" },
  { value: "hi", label: "हिन्दी", sub: "Hindi" },
  { value: "es", label: "Español", sub: "Spanish" },
];
const STAGES = [
  { value: "planning", label: "Planning to apply", icon: "calendar" as const },
  { value: "applied", label: "Applied, waiting", icon: "clock" as const },
  { value: "letter", label: "Got a letter", icon: "letter" as const },
  { value: "decided", label: "Have a decision", icon: "check" as const },
];
const DOCS = [
  { value: "passport", label: "Passport" },
  { value: "contract", label: "Work contract" },
  { value: "lease", label: "Rental agreement" },
  { value: "insurance", label: "Health insurance" },
];

export function MobileKitDemo() {
  const [lang, setLang] = useState<string | null>("en");
  const [stage, setStage] = useState<string | null>(null);
  const [docs, setDocs] = useState<string[]>(["passport"]);
  const [name, setName] = useState("");
  const [sheet, setSheet] = useState(false);
  return (
    <>
      <MobileFlowHeader back="/" title="Your case" progress={{ at: 2, of: 6 }} action={<Button variant="ghost" onClick={() => setSheet(true)}>Skip</Button>} />
      <MobilePage actions="double">
        <ScreenTitle title="Where are you in the process?" sub="Pick the one closest to today." />
        <OptionGrid label="Stage" options={STAGES} value={stage} onChange={setStage} />
        <OptionList label="Language" options={LANGS} value={lang} onChange={setLang} />
        <OptionList label="Documents" multiple options={DOCS} value={docs} onChange={setDocs} />
        <label className="ui-field">
          <span>Your first name</span>
          <input className="ui-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Arjun" autoComplete="given-name" />
        </label>
      </MobilePage>
      <StickyActionBar secondary={<Button variant="ghost" onClick={() => setSheet(true)}>I’ll do this later</Button>}>
        <Button variant="primary" disabled={!stage}>Continue</Button>
      </StickyActionBar>
      <BottomSheet open={sheet} onClose={() => setSheet(false)} title="Skip this step?"
        footer={<><Button onClick={() => setSheet(false)}>Keep going</Button><Button variant="primary" onClick={() => setSheet(false)}>Skip</Button></>}>
        <p className="ui-body">You can add your stage later from Settings. Dossierly will ask again when a letter arrives.</p>
      </BottomSheet>
    </>
  );
}
