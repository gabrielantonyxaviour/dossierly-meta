/* Live feature smoke test against the Meta Model API (costs a few cents). Needs MODEL_API_KEY.
   Run: node --env-file=.env.local --import tsx scripts/smoke.ts [features [letter.png]] */
import { introduce, interpret, watch, wrap } from "../src/lib/features/interpret";
import { linkLetter, readLetter } from "../src/lib/features/letters";
import { freshLocalEnv } from "../src/lib/server/local";

const out = (s: string) => process.stdout.write(`${s}\n`);
const KEY = process.env.MODEL_API_KEY ?? "";
const step = async (name: string, fn: () => Promise<unknown>) => {
  const t = Date.now();
  try {
    const r = JSON.stringify(await fn());
    out(`PASS ${name} (${Date.now() - t} ms) ${r.slice(0, 300)}`);
    return true;
  } catch (e) {
    out(`FAIL ${name}: ${e instanceof Error ? e.message : String(e)}`);
    return false;
  }
};

async function features() {
  const env = freshLocalEnv({ MODEL_API_KEY: KEY });
  const ctx = { env, userId: "smoke" };
  const turns = [{ speaker: "official" as const, original: "Decyzję może Pan odebrać do 14 listopada w pokoju 112.", translation: "You can collect the decision by 14 November in room 112." }];
  const ok = [
    await step("intro", () => introduce(ctx, { name: "Arjun Raman", language: "en", office: "Mazowiecki Urząd Wojewódzki" })),
    await step("interpret EN->PL", () => interpret(ctx, { speaker: "user", text: "I have my passport. Where do I pay the fee?", language: "en", recent: [] })),
    await step("interpret PL->HI", () => interpret(ctx, { speaker: "official", text: "Proszę o paszport i potwierdzenie opłaty skarbowej.", language: "hi", recent: [] })),
    await step("advice flag", () => interpret(ctx, { speaker: "user", text: "Should I sign this contract? Is it legal?", language: "en", recent: [] })),
    await step("watch", () => watch(ctx, { turns, language: "en" })),
    await step("wrap", () => wrap(ctx, { turns, language: "uk", office: "Mazowiecki Urząd Wojewódzki" })),
  ];
  const png = process.argv[3];
  if (png) {
    const { readFileSync } = await import("node:fs");
    const page = `data:image/png;base64,${readFileSync(png).toString("base64")}`;
    let letter: Awaited<ReturnType<typeof readLetter>>["letter"] | null = null;
    ok.push(
      await step("letters/read", async () => {
        const res = await readLetter(ctx, { pages: [page], language: "en" });
        letter = res.letter;
        return res;
      }),
    );
    if (letter !== null) {
      const c = { id: "c1", country: "pl" as const, type: "temporary_residence_work", office: "Mazowiecki Urząd Wojewódzki", caseNumber: "WSC-II-P.6151.48213.2026", profile: { name: "Arjun Raman", language: "en" as const }, events: [{ id: "e1", date: "2026-09-18", kind: "appointment" as const, title: "Fingerprints", summary: "Fingerprints taken." }], documents: [{ name: "Rental agreement", have: true }, { name: "Health insurance", have: false }], deadlines: [] };
      ok.push(await step("letters/link", async () => linkLetter(ctx, { letter: letter as never, deliveryDate: "2026-10-27", case: c, language: "en" })));
    }
  }
  process.exit(ok.every(Boolean) ? 0 : 1);
}

async function main() {
  if (!KEY) {
    out("MODEL_API_KEY is not set. Run: node --env-file=.env.local --import tsx scripts/smoke.ts [features [letter.png]]");
    process.exit(2);
  }
  await features();
}
void main();
