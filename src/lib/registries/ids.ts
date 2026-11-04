import { z } from "zod";

const WEIGHTS = [6, 5, 7, 2, 3, 4, 5, 6, 7];

/** Strips dashes, spaces and an optional "PL" prefix, then verifies 10 digits and the NIP checksum. */
export function normalizeNip(input: string): string | null {
  const digits = input.trim().replace(/^PL/i, "").replace(/[\s-]/g, "");
  if (!/^\d{10}$/.test(digits)) return null;
  const sum = WEIGHTS.reduce((acc, w, i) => acc + w * Number(digits[i]), 0) % 11;
  return sum === Number(digits[9]) ? digits : null;
}

/** KRS numbers are 10 digits; shorter inputs are left-padded with zeros. */
export function normalizeKrs(input: string): string | null {
  const digits = input.trim().replace(/[\s-]/g, "");
  if (!/^\d{1,10}$/.test(digits)) return null;
  return digits.padStart(10, "0");
}

export const checkQuerySchema = z
  .object({ nip: z.string().max(40).optional(), krs: z.string().max(40).optional() })
  .superRefine((v, ctx) => {
    if (!!v.nip === !!v.krs) ctx.addIssue({ code: "custom", message: "Provide exactly one of nip or krs" });
    else if (v.nip && !normalizeNip(v.nip)) ctx.addIssue({ code: "custom", path: ["nip"], message: "Invalid NIP" });
    else if (v.krs && !normalizeKrs(v.krs)) ctx.addIssue({ code: "custom", path: ["krs"], message: "Invalid KRS" });
  });

/** Today's calendar date in Europe/Warsaw (the white list rejects future dates). */
export function warsawToday(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Warsaw", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

export function longDate(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Warsaw", day: "numeric", month: "short", year: "numeric" }).format(new Date(iso));
}
