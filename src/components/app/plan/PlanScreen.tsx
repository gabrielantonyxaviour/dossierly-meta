"use client";
import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Button, Card, ErrorState, InlineError, Pill, Skeleton, TopBar } from "@/components/ui";
import { CopyButton } from "@/components/CopyButton";
import { Icon } from "@/components/Icon";
import { useLocale, useT } from "@/lib/i18n/client";
import { LOCALE_TAGS } from "@/lib/i18n/locales";
import { friendlyError } from "@/lib/client/api";
import { billing, zl, type BillingStatus, type PaidPlan } from "@/lib/client/billing";
import "@/components/ui/shell.css";
import "./plan.css";

const REF = /^[A-Za-z0-9-]{4,24}$/;

export function PlanScreen() {
  const t = useT("plan");
  const locale = useLocale();
  const params = useSearchParams();
  const paid = params.get("paid") === "1";
  const wanted = params.get("plan") === "household" ? "household_year" : "one_case";
  const [status, setStatus] = useState<BillingStatus | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [choice, setChoice] = useState<PaidPlan>(wanted);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);
  const [waiting, setWaiting] = useState(paid);

  const load = useCallback(async () => {
    const r = await billing.status();
    if (r.ok) { setStatus(r.data); setLoadError(null); return r.data; }
    setLoadError(friendlyError(r));
    return null;
  }, []);

  useEffect(() => {
    let alive = true;
    void billing.status().then((r) => {
      if (!alive) return;
      if (r.ok) setStatus(r.data);
      else setLoadError(friendlyError(r));
    });
    return () => { alive = false; };
  }, []);

  /* Back from Dodo: the webhook grants the plan; poll for up to 40 s. */
  useEffect(() => {
    if (!paid) return;
    let n = 0;
    const id = window.setInterval(async () => {
      const s = await load();
      if ((s && s.plan !== "free") || ++n >= 20) { setWaiting(false); window.clearInterval(id); }
    }, 2000);
    return () => window.clearInterval(id);
  }, [paid, load]);

  const date = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString(LOCALE_TAGS[locale], { day: "numeric", month: "long", year: "numeric" }) : "");

  if (!status && loadError) return <div className="sh-page"><ErrorState message={loadError} onRetry={() => void load()} /></div>;
  if (!status) return <div className="sh-page"><div style={{ height: 56 }} /><Skeleton h={40} w="50%" /><Skeleton h={140} r={20} /><Skeleton h={220} r={20} /></div>;

  const founding = status.plan === "free" && status.foundingSeatsLeft > 0;
  const casePrice = founding ? status.foundingPriceGrosz : status.prices.oneCaseGrosz;
  const validCode = code.trim() === "" || REF.test(code.trim());
  const pay = async () => {
    if (!validCode) return;
    setBusy(true); setPayError(null);
    const r = await billing.checkout(choice, code.trim() || undefined);
    if (r.ok) { window.location.assign(r.data.checkoutUrl); return; }
    setBusy(false);
    setPayError(r.code === "referral_invalid" ? t("refInvalid") : r.code === "referral_not_eligible" ? t("refNotEligible") : friendlyError(r));
  };

  return (
    <div className="sh-page pl">
      <TopBar title={t("title")} back={{ href: "/app", label: t("back") }} />

      {paid && (
        <Card className={`pl-paid ${status.plan !== "free" ? "is-ok" : ""}`} role="status">
          {status.plan !== "free" ? <><Icon name="check" size={18} /><span>{t("paidOk", { plan: status.planName })}</span></>
            : waiting ? <><span className="ui-spin" aria-hidden="true" /><span>{t("paidWaiting")}</span></>
            : <span>{t("paidLate")}</span>}
        </Card>
      )}

      <Card className="pl-current">
        <div className="pl-current-top"><span className="ui-meta">{t("current")}</span><Pill tone={status.plan === "free" ? "neutral" : "ok"}>{status.plan === "free" ? t("free") : status.planName}</Pill></div>
        {status.plan === "free" && <p className="pl-big">{t("lettersLeft", { n: status.lettersLeft ?? 0, of: status.freeLetters })}</p>}
        {status.plan !== "free" && status.expiresAt && <p className="pl-big">{t("until", { date: date(status.expiresAt) })}</p>}
        {status.renewalDue && <p className="pl-warn">{t("renewalDue")}</p>}
        {status.household && <p className="ui-meta">{t("members", { n: status.household.members.length + 1, of: status.household.limit })}</p>}
      </Card>

      {status.plan === "free" && (
        <>
          {founding && (
            <div className="pl-founding"><b>{t("foundingTitle", { price: zl(status.foundingPriceGrosz) })}</b><span>{t("foundingLeft", { n: status.foundingSeatsLeft, of: status.foundingCap })}</span></div>
          )}
          <div className="pl-options" role="radiogroup" aria-label={t("choose")}>
            {(["one_case", "household_year"] as const).map((p) => {
              const on = choice === p;
              const price = p === "one_case" ? casePrice : status.prices.householdYearGrosz;
              return (
                <button key={p} type="button" role="radio" aria-checked={on} className={`pl-opt${on ? " is-on" : ""}`} onClick={() => setChoice(p)}>
                  <span className="pl-opt-top"><b>{t(p === "one_case" ? "caseName" : "homeName")}</b><span className="pl-check" aria-hidden="true">{on && <Icon name="check" size={14} />}</span></span>
                  <span className="pl-opt-price">
                    <b>{zl(price)}</b>
                    {p === "one_case" && founding && <s>{zl(status.prices.oneCaseGrosz)}</s>}
                    <small>{t(p === "one_case" ? "caseUnit" : "homeUnit")}</small>
                  </span>
                  <span className="pl-opt-note">{t(p === "one_case" ? "caseNote" : "homeNote")}</span>
                </button>
              );
            })}
          </div>
          <label className="ui-field">
            <span className="ui-meta">{t("refLabel")}</span>
            <input className="ui-input" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder={t("refPlaceholder")} autoCapitalize="characters" autoComplete="off" maxLength={24} aria-invalid={!validCode} />
            <span className="ui-meta">{founding && choice === "one_case" ? t("refNoStack") : t("refHint", { amount: zl(status.referralRewardGrosz) })}</span>
          </label>
          {!validCode && <InlineError message={t("refFormat")} />}
          {payError && <InlineError message={payError} onRetry={() => void pay()} />}
          <Button variant="primary" size="lg" block loading={busy} disabled={busy || !validCode} onClick={() => void pay()}>{t("pay", { price: zl(choice === "one_case" ? casePrice : status.prices.householdYearGrosz) })}</Button>
          <p className="pl-fine">{t("fine")}</p>
        </>
      )}

      {status.referralCode && (
        <Card className="pl-ref">
          <b>{t("yourCode")}</b>
          <p className="ui-meta">{t("yourCodeHint", { amount: zl(status.referralRewardGrosz) })}</p>
          <div className="pl-ref-row"><code>{status.referralCode}</code><CopyButton text={status.referralCode} label={t("copy")} /></div>
          {status.creditGrosz > 0 && <p className="ui-meta">{t("credit", { amount: zl(status.creditGrosz) })}</p>}
        </Card>
      )}
    </div>
  );
}
