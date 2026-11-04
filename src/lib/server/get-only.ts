import { jsonError } from "./http";

/*
 * Re-export from a GET-only route so other methods answer with the API error shape instead of Next's empty 405:
 *   export { POST, PUT, PATCH, DELETE } from "@/lib/server/get-only";
 */
const notAllowed = () => jsonError(405, "This endpoint only supports GET", "method_not_allowed", { Allow: "GET, HEAD" });

export const POST = notAllowed;
export const PUT = notAllowed;
export const PATCH = notAllowed;
export const DELETE = notAllowed;
