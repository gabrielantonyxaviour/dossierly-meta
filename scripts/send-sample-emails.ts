/* Usage: npx tsx scripts/send-sample-emails.ts --base https://dossierly-look.cosmiclan.com --ids all|film|a7|id1,id2 [--date YYYY-MM-DD] [--to darthstormer.ai@gmail.com]
   film = the six-mail demo inbox (sent oldest first, so the office mails sit on top); --date is the fingerprint day (default today, Warsaw).
   a7   = the enrolment-certificate request (deadline Wed 25 Nov).
   Reads SAMPLE_MAIL_TOKEN from the environment; the token is never printed. */
import { SAMPLE_LETTERS } from "../src/lib/features/letters-samples";
import { FILM_SEED } from "../src/lib/features/film-mails";

const arg = (name: string, fallback?: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : fallback;
};

async function main() {
  const base = (arg("base") ?? "").replace(/\/$/, "");
  const to = arg("to", "darthstormer.ai@gmail.com") as string;
  const idsArg = arg("ids", "all") as string;
  const token = process.env.SAMPLE_MAIL_TOKEN;
  if (!base || !token) {
    process.stdout.write("Need --base and SAMPLE_MAIL_TOKEN in the environment\n");
    process.exit(2);
  }
  const date = arg("date");
  if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    process.stdout.write("--date must be YYYY-MM-DD\n");
    process.exit(2);
  }
  const ids = idsArg === "all" ? SAMPLE_LETTERS.map((l) => l.id)
    : idsArg === "film" ? [...FILM_SEED]
    : idsArg === "a7" ? ["film-enrolment-request"]
    : idsArg.split(",").map((s) => s.trim()).filter(Boolean);
  let failed = 0;
  for (const id of ids) {
    try {
      const res = await fetch(`${base}/api/letters/samples`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-sample-token": token },
        body: JSON.stringify({ id, to, ...(date ? { date } : {}) }),
      });
      const body = (await res.json().catch(() => ({}))) as { messageId?: string; attachments?: number; error?: string; code?: string };
      if (res.ok) process.stdout.write(`${id}: sent messageId=${body.messageId} attachments=${body.attachments}\n`);
      else { failed++; process.stdout.write(`${id}: ERROR ${res.status} ${body.code ?? ""} ${body.error ?? ""}\n`); }
    } catch {
      failed++;
      process.stdout.write(`${id}: ERROR network\n`);
    }
    if (ids.length > 1) await new Promise((r) => setTimeout(r, 2500)); // distinct arrival times keep the inbox order
  }
  process.exit(failed ? 1 : 0);
}
void main();
