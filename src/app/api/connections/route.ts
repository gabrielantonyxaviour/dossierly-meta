import { handler } from "@/lib/server/connections/handlers";

export const GET = handler("status");

export { POST, PUT, PATCH, DELETE } from "@/lib/server/get-only";
