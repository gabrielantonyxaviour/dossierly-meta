"use client";
import { useCallback, useEffect, useState } from "react";
import { BottomSheet, Button, Card, InlineError, OptionList, Row, Section, Skeleton, useToast } from "@/components/ui";
import { ago } from "../format";

/* Personal access tokens for the Dossierly MCP server (POST/GET/DELETE /api/mcp/tokens; docs/mcp.md). */

type Scope = "read" | "act";
type Token = { id: string; name: string; scope: Scope; prefix: string; createdAt: string; lastUsedAt: string | null };
type Created = Token & { token: string };

const SCOPES = [
  { value: "read" as const, label: "Read only", sub: "See your case, count deadlines, read letters, explain the law" },
  { value: "act" as const, label: "Read and act", sub: "Also add tasks and deadlines to your case" },
];

async function api<T>(method: "GET" | "POST" | "DELETE", body?: unknown): Promise<{ ok: true; data: T } | { ok: false; error: string }> {
  const res = await fetch("/api/mcp/tokens", { method, cache: "no-store", headers: body ? { "content-type": "application/json" } : undefined, body: body ? JSON.stringify(body) : undefined }).catch(() => null);
  const data = (await res?.json().catch(() => ({}))) as T & { error?: string };
  return res?.ok ? { ok: true, data } : { ok: false, error: data?.error ?? "Something went wrong. Try again." };
}

const command = (token: string) => `claude mcp add --transport http dossierly ${typeof window === "undefined" ? "https://dossierly.cosmiclan.com" : window.location.origin}/api/mcp --header "Authorization: Bearer ${token}"`;

function CopyBlock({ label, value }: { label: string; value: string }) {
  const { toast } = useToast();
  const copy = async () => {
    try { await navigator.clipboard.writeText(value); toast(`${label} copied`, { tone: "ok" }); } catch { toast("Couldn’t copy. Select the text instead.", { tone: "error" }); }
  };
  return (
    <div className="st-copy">
      <span className="st-copy-label">{label}</span>
      <code>{value}</code>
      <Button size="sm" icon="copy" onClick={() => void copy()}>Copy</Button>
    </div>
  );
}

export function AssistantSection() {
  const { toast } = useToast();
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
    const r = await api<Created>("POST", { name: name.trim() || "AI assistant", scope });
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
    toast(`Revoked “${revoking.name}”`, { tone: "ok" });
    setRevoking(null);
    void load();
  };

  return (
    <Section title="Connect an AI assistant">
      <p className="ui-body st-note">Let Claude, ChatGPT or your own agent use Dossierly’s tools on your case: deadlines counted the way Polish law does, letters read, KPA explained.</p>
      <Card flush>
        {tokens === null && !loadError && <div className="st-pad"><Skeleton h={44} /></div>}
        {loadError && <div className="st-pad"><InlineError message={loadError} onRetry={() => void load()} /></div>}
        {tokens?.map((t) => (
          <Row key={t.id} icon="link" title={t.name}
            sub={`${t.scope === "act" ? "Read and act" : "Read only"} · ${t.prefix}… · ${t.lastUsedAt ? `used ${ago(t.lastUsedAt).toLowerCase()}` : "never used"}`}
            end={<Button size="sm" variant="ghost" onClick={() => setRevoking(t)}>Revoke</Button>} />
        ))}
        <Row icon="plus" title="Create an access token" sub={tokens?.length ? `${tokens.length} active · up to 10` : "One token per assistant. You can revoke it any time."} onClick={() => { setFormError(null); setCreating(true); }} chevron />
      </Card>

      <BottomSheet open={creating} onClose={() => setCreating(false)} title="New access token"
        footer={<><Button onClick={() => setCreating(false)}>Cancel</Button><Button variant="primary" loading={busy} onClick={() => void create()}>Create token</Button></>}>
        <div className="st-form">
          <label className="ui-field">
            <span>Name</span>
            <input className="ui-input" value={name} maxLength={60} onChange={(e) => setName(e.target.value)} placeholder="Claude Code" autoComplete="off" />
          </label>
          <OptionList label="What it can do" options={SCOPES} value={scope} onChange={setScope} />
          {formError && <InlineError message={formError} />}
        </div>
      </BottomSheet>

      <BottomSheet open={!!created} onClose={() => setCreated(null)} title="Copy your token now"
        footer={<Button variant="primary" onClick={() => setCreated(null)}>Done</Button>}>
        {created && (
          <div className="st-form">
            <p className="ui-body">This is the only time Dossierly shows it. It’s stored as a hash, so it can’t be shown again.</p>
            <CopyBlock label="Token" value={created.token} />
            <CopyBlock label="Add to Claude Code" value={command(created.token)} />
            <p className="ui-meta">Other clients: HTTP transport, URL …/api/mcp, header Authorization: Bearer &lt;token&gt;.</p>
          </div>
        )}
      </BottomSheet>

      <BottomSheet open={!!revoking} onClose={() => setRevoking(null)} title="Revoke this token?"
        footer={<><Button onClick={() => setRevoking(null)}>Keep it</Button><Button variant="danger" loading={busy} onClick={() => void revoke()}>Revoke</Button></>}>
        <p className="ui-body">“{revoking?.name}” stops working immediately. Any assistant using it loses access to your case.</p>
      </BottomSheet>
    </Section>
  );
}
