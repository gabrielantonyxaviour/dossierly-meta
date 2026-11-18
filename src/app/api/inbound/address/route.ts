import { addressHandler } from "@/lib/inbound/handler";

export const GET = addressHandler("get");

export { POST, PUT, PATCH, DELETE } from "@/lib/server/get-only";
