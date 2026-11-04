/* Usage: npx tsx scripts/send-sample-emails.ts --base https://dossierly-look.cosmiclan.com --ids all|id1,id2 --to darthstormer.ai@gmail.com
   Reads SAMPLE_MAIL_TOKEN from the environment; the token is never printed. */
import { SAMPLE_LETTERS } from "../src/lib/features/letters-samples";

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
  const ids = idsArg === "all" ? SAMPLE_LETTERS.map((l) => l.id) : idsArg.split(",").map((s) => s.trim()).filter(Boolean);
  let failed = 0;
  for (const id of ids) {
    try {
      const res = await fetch(`${base}/api/letters/samples`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-sample-token": token },
        body: JSON.stringify({ id, to }),
      });
      const body = (await res.json().catch(() => ({}))) as { messageId?: string; attachments?: number; error?: string; code?: string };
      if (res.ok) process.stdout.write(`${id}: sent messageId=${body.messageId} attachments=${body.attachments}\n`);
      else { failed++; process.stdout.write(`${id}: ERROR ${res.status} ${body.code ?? ""} ${body.error ?? ""}\n`); }
    } catch {
      failed++;
      process.stdout.write(`${id}: ERROR network\n`);
    }
  }
  process.exit(failed ? 1 : 0);
}
void main();
