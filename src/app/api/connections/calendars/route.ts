import { handler } from "@/lib/server/connections/handlers";

export const GET = handler("calendars");

export { POST, PUT, PATCH, DELETE } from "@/lib/server/get-only";
