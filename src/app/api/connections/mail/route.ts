import { handler } from "@/lib/server/connections/handlers";

export const GET = handler("mail");

export { POST, PUT, PATCH, DELETE } from "@/lib/server/get-only";
