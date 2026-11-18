import { Select } from "@/components/ui/Select";
import { useT } from "@/lib/i18n/client";
import { needLabel, sampleFor, type Need } from "./content";
import { evidenceCopy, paperStories } from "./paper-content";

type Message = { question: string; source: Need | null; response: boolean };
export type ChatState = { draft: string; bringing: boolean; reviewing: boolean; attached: boolean; source: Need; messages: Message[]; error: string };
export const emptyChat = (): ChatState => ({ draft: "", bringing: false, reviewing: false, attached: false, source: "letters", messages: [], error: "" });

export function CaseChatPreview({ state, update, needs }: { state: ChatState; update(state: ChatState): void; needs: Need[] }) {
  const t = useT("tour");
  const source = needs.includes(state.source) ? state.source : needs[0];
  function patch(value: Partial<ChatState>) { update({ ...state, ...value }); }
  function review() {
    if (!state.draft.trim()) { patch({ error: t("errQuestion") }); document.getElementById("preview-question")?.focus(); return; }
    patch({ reviewing: true, error: "" });
    requestAnimationFrame(() => document.getElementById("question-review-title")?.focus());
  }
  function add() {
    patch({ messages: [...state.messages, { question: state.draft.trim(), source: state.attached ? source : null, response: false }], draft: "", bringing: false, reviewing: false, attached: false });
    requestAnimationFrame(() => document.getElementById("preview-question")?.focus());
  }
  return <section className="op-chat" aria-labelledby="chat-title">
    <header className="op-chat-header"><div><span className="op-eyebrow">{t("chatEyebrow")}</span><h2 id="chat-title">{t("chatTitle")}</h2></div><span className="op-badge">{t("sampleWorkspace")}</span></header>
    <p className="op-help">{t("chatIntro")}</p>
    <div className="op-chat-messages" role="log" aria-label={t("chatLogAria")} aria-live="polite">
      {!state.messages.length && <div className="op-chat-welcome"><span className="op-assistant-dot" aria-hidden="true" /><div><h3>{t("welcomeTitle")}</h3><p>{t("welcomeBody")}</p></div></div>}
      {state.messages.map((message, index) => <div className="op-chat-turn" key={index}>
        <div className="op-chat-user"><span className="op-eyebrow">{t("youPreview")}</span><p>{message.question}</p>{message.source && <span className="op-chat-source-chip">▤ {sampleFor(message.source, t).kind}</span>}</div>
        {message.response ? <div className="op-chat-response"><span className="op-eyebrow">{t("responseEyebrow")}</span><h3 id={`chat-response-${index}`} tabIndex={-1}>{t("responseTitle")}</h3><p className="op-help">{t("responseHelp")}</p>
          {message.source ? <><p>{evidenceCopy(message.source, "request", t).explanation}</p><details><summary>{t("sourceUsed")}</summary><blockquote lang="pl">{paperStories[message.source].request.text}</blockquote><p className="op-help">{t("fictionalCase", { label: needLabel(message.source, t) })}</p></details><p><strong>{t("possibleNext")}</strong> {sampleFor(message.source, t).action}</p></> : <p>{t("noSourceResponse")}</p>}
          <p className="op-help">{t("youDecide")}</p>
        </div> : <div className="op-chat-response"><p className="op-help">{t("questionAdded")}</p><button type="button" className="op-text-button" onClick={() => { patch({ messages: state.messages.map((item, i) => i === index ? { ...item, response: true } : item) }); requestAnimationFrame(() => document.getElementById(`chat-response-${index}`)?.focus()); }}>{t("showResponse")}</button></div>}
      </div>)}
    </div>
    {state.reviewing ? <section className="op-question-review" aria-labelledby="question-review-title"><span className="op-eyebrow">{t("beforeAdding")}</span><h3 id="question-review-title" tabIndex={-1}>{t("reviewQTitle")}</h3><p className="op-question-copy">{state.draft}</p><dl><dt>{t("selectedContext")}</dt><dd>{state.attached ? t("contextAttached", { kind: sampleFor(source, t).kind }) : t("noSource")}</dd></dl><p className="op-help">{t("reviewNote")}</p><div className="op-chat-actions"><button type="button" className="btn btn-primary" onClick={add}>{t("addToChat")}</button><button type="button" className="op-text-button" onClick={() => { patch({ reviewing: false }); requestAnimationFrame(() => document.getElementById("preview-question")?.focus()); }}>{t("editQuestion")}</button></div></section>
      : <div className="op-composer-area">
        <div className="op-chat-toolbar"><button type="button" className="op-text-button" aria-expanded={state.bringing} onClick={() => { patch({ bringing: !state.bringing }); requestAnimationFrame(() => document.getElementById("preview-question")?.focus()); }}>{t("bringQuestion")} <span aria-hidden="true">↓</span></button><span className="op-help">{t("pasteChoose")}</span></div>
        {state.bringing && <p id="paste-help" className="op-helper-note">{t("pasteHelp")}</p>}
        <div className="op-composer"><label className="sr-only" htmlFor="preview-question">{t(state.bringing ? "pasteLabel" : "previewQLabel")}</label><textarea id="preview-question" value={state.draft} onChange={(event) => patch({ draft: event.target.value, error: "" })} rows={3} maxLength={2000} placeholder={t(state.bringing ? "pastePlaceholder" : "askPlaceholder")} aria-describedby={state.error ? "question-error" : "composer-help"} aria-invalid={!!state.error} />
          {state.attached && <div className="op-attachment-choice"><span id="chat-source-label" className="op-help">{t("sourceContext")}</span><Select labelledBy="chat-source-label" value={source} options={needs.map((need) => ({ value: need, label: sampleFor(need, t).kind }))} onChange={(value) => patch({ source: value as Need })} /></div>}
          <div className="op-composer-controls"><button type="button" className="op-text-button" aria-pressed={state.attached} onClick={() => patch({ attached: !state.attached, source })}><span aria-hidden="true">{state.attached ? "−" : "+"}</span>{t(state.attached ? "removeSource" : "attachSource")}</button><button type="button" className="btn btn-primary" onClick={review}>{t("reviewQuestion")} <span aria-hidden="true">↑</span></button></div>
        </div>{state.error && <p id="question-error" className="op-error" role="alert">{state.error}</p>}<p id="composer-help" className="op-help">{t("composerHelp")}</p>
      </div>}
  </section>;
}
