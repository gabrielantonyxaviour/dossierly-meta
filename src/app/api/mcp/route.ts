import { handleMcpPost, methodNotAllowed } from "@/lib/mcp/http";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Dossierly MCP server (Streamable HTTP, JSON-RPC 2.0). See docs/mcp.md. */
export async function POST(req: Request) {
  return handleMcpPost(req);
}
export const GET = methodNotAllowed;
export const DELETE = methodNotAllowed;
