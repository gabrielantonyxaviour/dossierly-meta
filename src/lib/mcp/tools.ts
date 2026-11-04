import { aiTools } from "./tools-ai";
import { caseTools } from "./tools-case";
import { legalTools } from "./tools-legal";
import type { ToolDef } from "./types";

export const TOOLS: ToolDef[] = [...caseTools, ...legalTools, ...aiTools];
export const findTool = (name: string): ToolDef | undefined => TOOLS.find((t) => t.name === name);
