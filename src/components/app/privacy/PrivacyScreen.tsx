"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useCase } from "@/lib/client/store";
import { Icon } from "../../Icon";
import { LedgerPanel } from "./LedgerPanel";
import { RunsPanel } from "./RunsPanel";

function VaultCard() {
  return (
    <section className="card stack" aria-labelledby="vault-h" style={{ ["--gap" as string]: "10px" }}>
      <div className="row between">
        <h2 id="vault-h" className="h-card">Your case on this device</h2>
        <span className="chip"><Icon name="lock" size={14} /> AES-256-GCM</span>
      </div>
      <p className="small" style={{ margin: 0 }}>
        Your case is encrypted in this browser. For new cases, a non-exportable device key protects the saved data.
        Anyone using this unlocked browser profile may be able to open it.
      </p>
      <p className="small muted" style={{ margin: 0 }}>
        Email codes let you return to your account. They do not unlock older encrypted cases or recover data removed from this browser.
      </p>
    </section>
  );
}

function DeleteCard() {
  const { wipe } = useCase();
  const router = useRouter();
  const [armed, setArmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const del = async () => {
    setBusy(true);
    await wipe();
    router.push("/app");
  };
  return (
    <section className="card stack" aria-labelledby="del-h" style={{ ["--gap" as string]: "10px" }}>
      <h2 id="del-h" className="h-card">Delete everything</h2>
      <p className="small muted" style={{ margin: 0 }}>Destroys the encryption key and wipes the case, letters and wrap-ups from this device. This cannot be undone. To also erase the server ledger and your account, email contact@cosmiclan.com.</p>
      {armed ? (
        <div className="row">
          <button className="btn btn-danger" onClick={() => void del()} disabled={busy}>{busy ? "Deleting…" : "Yes, delete my case"}</button>
          <button className="btn btn-ghost" onClick={() => setArmed(false)}>Keep it</button>
        </div>
      ) : (
        <button className="btn btn-danger" style={{ alignSelf: "start" }} onClick={() => setArmed(true)}>Delete my case from this device</button>
      )}
    </section>
  );
}

export function PrivacyScreen() {
  return (
    <div className="page page-wide stack" style={{ ["--gap" as string]: "18px" }}>
      <div>
        <span className="tab-label">Privacy you can check</span>
        <h1 className="page-title">What happened to your data</h1>
        <p className="muted" style={{ margin: 0 }}>Not &quot;fully private&quot;: here is exactly what leaves your phone, where it goes, and what we keep.</p>
      </div>
      <div className="can-cannot">
        <section className="card">
          <h2 className="h-card">What we can see</h2>
          <ul className="small" style={{ marginTop: 8, display: "grid", gap: 6 }}>
            <li>The text of a request while it is processed, with your name, case number and addresses replaced by placeholders before any model call.</li>
            <li>Your private agent sees the masked case as plain text while it works, and keeps a masked copy as its memory.</li>
            <li>The ledger: which model ran, when, how many bytes, how many IDs were masked.</li>
            <li>Letter images, only as ciphertext if you save them.</li>
          </ul>
        </section>
        <section className="card">
          <h2 className="h-card">What we cannot see</h2>
          <ul className="small" style={{ marginTop: 8, display: "grid", gap: 6 }}>
            <li>Your saved case: it is encrypted on this device and never uploaded as a whole.</li>
            <li>Audio: Dossierly never receives or stores it.</li>
            <li>Model training: every call is sent with storage switched off. Check Meta&apos;s current terms for how model inputs are handled.</li>
          </ul>
        </section>
      </div>
      <LedgerPanel />
      <RunsPanel />
      <VaultCard />
      <DeleteCard />
    </div>
  );
}
