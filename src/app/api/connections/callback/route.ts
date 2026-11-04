import { handler } from "@/lib/server/connections/handlers";

export const GET = handler("callback");

export { POST, PUT, PATCH, DELETE } from "@/lib/server/get-only";
