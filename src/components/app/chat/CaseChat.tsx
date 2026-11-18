"use client";
import Link from "next/link";
import { useRef } from "react";
import { Select } from "@/components/ui/Select";
import { useT } from "@/lib/i18n/client";
import { rich } from "@/lib/i18n/rich";
import { useCaseChat } from "./useCaseChat";
import "./case-chat.css";

export function CaseChat() {
  const t = useT("chat");
  const { chat, loaded, error, active, sources, update, send, stop } = useCaseChat();
  const composer = useRef<HTMLTextAreaElement>(null);
  const source = sources.find((item) => item.id === chat.sourceId);
  const edit = () => { update((old) => ({ ...old, reviewing: false })); requestAnimationFrame(() => composer.current?.focus()); };
  return <section className="cc-chat" aria-labelledby="case-chat-title">
    <header className="cc-intro"><span className="tab-label">{t("ccKicker")}</span><h2 id="case-chat-title">{t("ccTitle")}</h2><p>{t("ccIntro")}</p></header>
    {!loaded && <p role="status">{t("ccOpening")}</p>}
    {error && <p role="alert" className="cc-error">{error}</p>}
    <div className="cc-messages" aria-label={t("ccAria")}>
      {chat.messages.map((message) => <article className="cc-exchange" key={message.id}>
        <div className="cc-question"><span className="cc-label">{t("you")}</span><p>{message.question}</p>{message.sourceId && <small>{t("ccLetterAttached")}</small>}</div>
        <div className="cc-answer"><span className="cc-label">Dossierly</span>
          {(message.state === "sending" || message.state === "queued" || message.state === "running") && <div role="status"><p>{message.state === "sending" ? t("ccSending") : message.state === "queued" ? t("ccQueued") : t("ccRunning")}</p>{message.taskId && <button type="button" className="btn btn-small" onClick={() => void stop()}>{t("ccStop")}</button>}</div>}
          {message.state === "done" && message.answer && <><p className="cc-answer-text">{message.answer.answer}</p>{message.answer.notice && <p className="cc-notice">{message.answer.notice}</p>}{message.answer.citations.length > 0 && <details className="cc-sources"><summary>{t("ccSources", { n: message.answer.citations.length })}</summary><ol>{message.answer.citations.map((citation, i) => <li key={i}><a href={/^https:\/\//.test(citation.url) ? citation.url : undefined} target="_blank" rel="noreferrer">{citation.title} ↗</a><blockquote>{citation.quote}</blockquote></li>)}</ol></details>}</>}
          {(message.state === "failed" || message.state === "stopped") && <><p role="status">{message.error || t("ccDidNotFinish")}</p><button type="button" className="btn btn-small" disabled={!!active} onClick={() => void send(message.question, message.sourceId)}>{t("ccRetryNew")}</button></>}
        </div>
      </article>)}
    </div>
    <form className="cc-composer" onSubmit={(event) => { event.preventDefault(); update((old) => ({ ...old, reviewing: true })); }}>
      <label htmlFor="case-question">{t("ccQuestion")}</label>
      <textarea ref={composer} id="case-question" className="input" rows={4} maxLength={1500} value={chat.draft} disabled={!loaded || !!active} onPaste={() => update((old) => ({ ...old, pasted: true }))} onChange={(event) => update((old) => ({ ...old, draft: event.target.value, reviewing: false }))} placeholder={t("ccPlaceholder")} />
      <div className="cc-context"><span id="chat-source-label">{t("ccAttachContext")}</span><Select labelledBy="chat-source-label" value={chat.sourceId || "none"} onChange={(value) => update((old) => ({ ...old, sourceId: value === "none" ? null : value, reviewing: false }))} options={[{ value: "none", label: t("ccCaseOnly") }, ...sources.map((item) => ({ value: item.id, label: item.title }))]} disabled={!!active || !loaded} /></div>
      <div className="cc-compose-actions"><button type="button" className="cc-link" disabled={!!active || !loaded} onClick={() => { update((old) => ({ ...old, pasted: true })); composer.current?.focus(); }}>{t("ccBring")}</button><button type="submit" className="btn btn-primary" disabled={!loaded || !!active || !chat.draft.trim()}>{t("ccReview")}</button></div>
      {chat.pasted && <p className="cc-note">{t("ccPasteNote")}</p>}
      {!sources.length && <p className="cc-note">{rich(t("ccNoLetters"), { link: <Link href="/app/letters">{t("ccAddLetter")}</Link> })}</p>}
    </form>
    {chat.reviewing && <section className="cc-review" aria-labelledby="question-review-title"><h3 id="question-review-title">{t("ccReviewTitle")}</h3><p className="cc-answer-text">{chat.draft}</p><p className="cc-note">{source ? t("ccContextLetter", { title: source.title }) : t("ccContextChecklist")}</p>{source?.extracted && <details><summary>{t("ccReviewExcerpt")}</summary><p>{source.extracted.asks.join("\n")}</p></details>}<p className="cc-note">{t("ccUnverified")}</p><div className="cc-compose-actions"><button type="button" className="btn" onClick={edit}>{t("ccEdit")}</button><button type="button" className="btn btn-primary" disabled={!!active} onClick={() => void send()}>{t("ccSend")}</button></div></section>}
  </section>;
}
