"use client";
import { useCallback, useEffect, useState } from "react";
import { BottomSheet, Button, Card, InlineError, OptionList, Row, Section, Skeleton, useToast } from "@/components/ui";
import { useT } from "@/lib/i18n/client";
import { tNow } from "@/lib/i18n/current";
import { ago } from "../format";

/* Personal access tokens for the Dossierly MCP server (POST/GET/DELETE /api/mcp/tokens; docs/mcp.md). */

type Scope = "read" | "act";
type Token = { id: string; name: string; scope: Scope; prefix: string; createdAt: string; lastUsedAt: string | null };
type Created = Token & { token: string };

async function api<T>(method: "GET" | "POST" | "DELETE", body?: unknown): Promise<{ ok: true; data: T } | { ok: false; error: string }> {
  const res = await fetch("/api/mcp/tokens", { method, cache: "no-store", headers: body ? { "content-type": "application/json" } : undefined, body: body ? JSON.stringify(body) : undefined }).catch(() => null);
  const data = (await res?.json().catch(() => ({}))) as T & { error?: string };
  return res?.ok ? { ok: true, data } : { ok: false, error: data?.error ?? tNow("settings")("genericError") };
}

const command = (token: string) => `claude mcp add --transport http dossierly ${typeof window === "undefined" ? "https://dossierly.cosmiclan.com" : window.location.origin}/api/mcp --header "Authorization: Bearer ${token}"`;

function CopyBlock({ label, value }: { label: string; value: string }) {
  const { toast } = useToast();
  const t = useT("settings");
  const copy = async () => {
    try { await navigator.clipboard.writeText(value); toast(t("copiedLabel", { label }), { tone: "ok" }); } catch { toast(t("copyFailed"), { tone: "error" }); }
  };
  return (
    <div className="st-copy">
      <span className="st-copy-label">{label}</span>
      <code>{value}</code>
      <Button size="sm" icon="copy" onClick={() => void copy()}>{t("copy")}</Button>
    </div>
  );
}

export function AssistantSection() {
  const { toast } = useToast();
  const t = useT("settings");
  const scopeLabel = (s: Scope) => (s === "act" ? t("scopeAct") : t("scopeRead"));
  const scopes = [
    { value: "read" as const, label: t("scopeRead"), sub: t("scopeReadSub") },
    { value: "act" as const, label: t("scopeAct"), sub: t("scopeActSub") },
  ];
  const [tokens, setTokens] = useState<Token[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("Claude Code");
  const [scope, setScope] = useState<Scope>("read");
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [created, setCreated] = useState<Created | null>(null);
  const [revoking, setRevoking] = useState<Token | null>(null);

  const load = useCallback(async () => {
    const r = await api<{ tokens: Token[] }>("GET");
    if (r.ok) { setTokens(r.data.tokens); setLoadError(null); } else setLoadError(r.error);
  }, []);
  useEffect(() => {
    let live = true;
    void api<{ tokens: Token[] }>("GET").then((r) => { if (!live) return; if (r.ok) setTokens(r.data.tokens); else setLoadError(r.error); });
    return () => { live = false; };
  }, []);

  const create = async () => {
    setBusy(true); setFormError(null);
    const r = await api<Created>("POST", { name: name.trim() || t("defaultTokenName"), scope });
    setBusy(false);
    if (!r.ok) return setFormError(r.error);
    setCreating(false);
    setCreated(r.data);
    void load();
  };
  const revoke = async () => {
    if (!revoking) return;
    setBusy(true);
    const r = await api<{ ok: true }>("DELETE", { id: revoking.id });
    setBusy(false);
    if (!r.ok) return toast(r.error, { tone: "error" });
    toast(t("revoked", { name: revoking.name }), { tone: "ok" });
    setRevoking(null);
    void load();
  };

  return (
    <Section title={t("assistantTitle")}>
      <p className="ui-body st-note">{t("assistantIntro")}</p>
      <Card flush>
        {tokens === null && !loadError && <div className="st-pad"><Skeleton h={44} /></div>}
        {loadError && <div className="st-pad"><InlineError message={loadError} onRetry={() => void load()} /></div>}
        {tokens?.map((k) => (
          <Row key={k.id} icon="link" title={k.name}
            sub={`${scopeLabel(k.scope)} · ${k.prefix}… · ${k.lastUsedAt ? t("usedAgo", { ago: ago(k.lastUsedAt).toLowerCase() }) : t("neverUsed")}`}
            end={<Button size="sm" variant="ghost" onClick={() => setRevoking(k)}>{t("revoke")}</Button>} />
        ))}
        <Row icon="plus" title={t("createToken")} sub={tokens?.length ? t("tokensActive", { n: tokens.length, max: 10 }) : t("createTokenSub")} onClick={() => { setFormError(null); setCreating(true); }} chevron />
      </Card>

      <BottomSheet open={creating} onClose={() => setCreating(false)} title={t("newToken")}
        footer={<><Button onClick={() => setCreating(false)}>{t("cancel")}</Button><Button variant="primary" loading={busy} onClick={() => void create()}>{t("createTokenButton")}</Button></>}>
        <div className="st-form">
          <label className="ui-field">
            <span>{t("tokenName")}</span>
            <input className="ui-input" value={name} maxLength={60} onChange={(e) => setName(e.target.value)} placeholder="Claude Code" autoComplete="off" />
          </label>
          <OptionList label={t("tokenScope")} options={scopes} value={scope} onChange={setScope} />
          {formError && <InlineError message={formError} />}
        </div>
      </BottomSheet>

      <BottomSheet open={!!created} onClose={() => setCreated(null)} title={t("copyNowTitle")}
        footer={<Button variant="primary" onClick={() => setCreated(null)}>{t("done")}</Button>}>
        {created && (
          <div className="st-form">
            <p className="ui-body">{t("copyNowBody")}</p>
            <CopyBlock label={t("tokenLabel")} value={created.token} />
            <CopyBlock label={t("addToClaude")} value={command(created.token)} />
            <p className="ui-meta">{t("otherClients")}</p>
          </div>
        )}
      </BottomSheet>

      <BottomSheet open={!!revoking} onClose={() => setRevoking(null)} title={t("revokeTitle")}
        footer={<><Button onClick={() => setRevoking(null)}>{t("keepIt")}</Button><Button variant="danger" loading={busy} onClick={() => void revoke()}>{t("revoke")}</Button></>}>
        <p className="ui-body">{t("revokeBody", { name: revoking?.name ?? "" })}</p>
      </BottomSheet>
    </Section>
  );
}
