import Image from "next/image";
import { useT } from "@/lib/i18n/client";
import { groupLabel, providerCopy, providers, type Tool } from "./providers";

export function ToolsStep({ selected, expanded, expand, select }: {
  selected: Tool[]; expanded: Tool | null; expand(tool: Tool | null): void; select(tool: Tool): void;
}) {
  const t = useT("tour");
  function group(title: string) {
    return <div className="op-tool-group">{providers.filter((tool) => tool.group === title).map((tool) => <section className="op-tool" key={tool.id} aria-labelledby={`tool-${tool.id}`}>
      <div className="op-tool-heading">
        <Image className="op-tool-logo" src={`/onboarding-preview/providers/${tool.logo}`} alt="" width={36} height={36} unoptimized />
        <div><h3 id={`tool-${tool.id}`}>{tool.title}</h3><p className="op-help">{providerCopy(tool, t).purpose}</p></div>
      </div>
      {selected.includes(tool.id) ? <div className="op-tool-selection">
        <span className="op-selected" role="status">{t("selectedForSetup")}</span>
        <button id={`remove-tool-${tool.id}`} type="button" className="op-text-button" onClick={() => select(tool.id)} aria-label={t("removeAria", { tool: tool.title })}>{t("remove")}</button>
      </div> : <button id={`preview-tool-${tool.id}`} type="button" className="op-text-button" aria-expanded={expanded === tool.id} aria-controls={`permissions-${tool.id}`} onClick={() => expand(expanded === tool.id ? null : tool.id)}>{t("previewSetup", { tool: tool.title })} <span aria-hidden="true">{expanded === tool.id ? "−" : "+"}</span></button>}
      {expanded === tool.id && !selected.includes(tool.id) && <div className="op-permissions" id={`permissions-${tool.id}`}>
        <h4>{t("permissionPreview")}</h4><p>{providerCopy(tool, t).permission}</p><p className="op-help">{providerCopy(tool, t).boundary}</p>
        <a className="op-help" href={tool.reference} target="_blank" rel="noreferrer">{t("providerRef")}</a>
        <button type="button" className="btn" onClick={() => select(tool.id)}>{t("selectTool", { tool: tool.title })}</button>
      </div>}
    </section>)}</div>;
  }
  return <div className="op-tools">
    <p className="op-helper-note">{t("toolsNote")}</p>
    {["Mail", "Calendar"].map((title) => <section className="op-provider-category" key={title}><h2>{groupLabel(title, t)} <span className="op-help">{t("optionalChooseOne")}</span></h2>{group(title)}</section>)}
    <p className="op-help">{t("docsNote")}</p>
  </div>;
}
