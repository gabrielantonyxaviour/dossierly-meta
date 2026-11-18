"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useCase } from "@/lib/client/store";
import { useT } from "@/lib/i18n/client";
import { Icon } from "../../Icon";
import { LedgerPanel } from "./LedgerPanel";
import { RunsPanel } from "./RunsPanel";

function VaultCard() {
  const t = useT("privacy");
  return (
    <section className="card stack" aria-labelledby="vault-h" style={{ ["--gap" as string]: "10px" }}>
      <div className="row between">
        <h2 id="vault-h" className="h-card">{t("vaultTitle")}</h2>
        <span className="chip"><Icon name="lock" size={14} /> AES-256-GCM</span>
      </div>
      <p className="small" style={{ margin: 0 }}>{t("vaultBody")}</p>
      <p className="small muted" style={{ margin: 0 }}>{t("vaultCodes")}</p>
    </section>
  );
}

function DeleteCard() {
  const t = useT("privacy");
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
      <h2 id="del-h" className="h-card">{t("deleteTitle")}</h2>
      <p className="small muted" style={{ margin: 0 }}>{t("deleteBody")}</p>
      {armed ? (
        <div className="row">
          <button className="btn btn-danger" onClick={() => void del()} disabled={busy}>{busy ? t("deleting") : t("deleteConfirm")}</button>
          <button className="btn btn-ghost" onClick={() => setArmed(false)}>{t("keepIt")}</button>
        </div>
      ) : (
        <button className="btn btn-danger" style={{ alignSelf: "start" }} onClick={() => setArmed(true)}>{t("deleteButton")}</button>
      )}
    </section>
  );
}

export function PrivacyScreen() {
  const t = useT("privacy");
  const can = [t("can1"), t("can2"), t("can3"), t("can4")];
  const cannot = [t("cannot1"), t("cannot2"), t("cannot3")];
  return (
    <div className="page page-wide stack" style={{ ["--gap" as string]: "18px" }}>
      <div>
        <span className="tab-label">{t("kicker")}</span>
        <h1 className="page-title">{t("title")}</h1>
        <p className="muted" style={{ margin: 0 }}>{t("lead")}</p>
      </div>
      <div className="can-cannot">
        <section className="card">
          <h2 className="h-card">{t("canTitle")}</h2>
          <ul className="small" style={{ marginTop: 8, display: "grid", gap: 6 }}>
            {can.map((x) => <li key={x}>{x}</li>)}
          </ul>
        </section>
        <section className="card">
          <h2 className="h-card">{t("cannotTitle")}</h2>
          <ul className="small" style={{ marginTop: 8, display: "grid", gap: 6 }}>
            {cannot.map((x) => <li key={x}>{x}</li>)}
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
