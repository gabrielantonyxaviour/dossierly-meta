/* One live call per Meta provider helper. Needs MODEL_API_KEY in the environment (never printed).
   Run: MODEL_API_KEY=... node --import tsx scripts/meta-smoke.ts [letter.png] [speech.wav]
   Without the optional files it builds a synthetic letter image and a short tone WAV. */
import { readFileSync } from "node:fs";
import { deflateSync } from "node:zlib";
import { createMetaClient, metaChatStream, metaJson, samSegment, transcribeFile, visionGround, webSearch } from "../src/lib/model/meta";

const out = (s: string) => process.stdout.write(`${s}\n`);
const env = { MODEL_API_KEY: process.env.MODEL_API_KEY ?? "" };

const step = async (name: string, fn: () => Promise<unknown>) => {
  const t = Date.now();
  try {
    const result = JSON.stringify(await fn()).slice(0, 260);
    out(`PASS ${name} (${Date.now() - t} ms) ${result}`);
    return true;
  } catch (e) {
    out(`FAIL ${name}: ${e instanceof Error ? `${e.name} ${e.message}` : String(e)}`);
    return false;
  }
};

function pngSize(buf: Buffer): { w: number; h: number } {
  return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
}

/** A plain white PNG with a dark bar: enough pixels for grounding and SAM to run on. */
function syntheticPng(w = 640, h = 400): Buffer {
  const raw = Buffer.alloc((w * 3 + 1) * h, 255);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 3 + 1)] = 0;
    if (y > 150 && y < 190) raw.fill(30, y * (w * 3 + 1) + 1 + 60 * 3, y * (w * 3 + 1) + 1 + 560 * 3);
  }
  const crc = (b: Buffer) => {
    let c = ~0;
    for (const x of b) { c ^= x; for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1)); }
    return ~c >>> 0;
  };
  const chunk = (type: string, data: Buffer) => {
    const body = Buffer.concat([Buffer.from(type), data]);
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const sum = Buffer.alloc(4); sum.writeUInt32BE(crc(body));
    return Buffer.concat([len, body, sum]);
  };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ihdr), chunk("IDAT", deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);
}

function toneWav(seconds = 1, rate = 16000): Uint8Array {
  const n = seconds * rate;
  const buf = Buffer.alloc(44 + n * 2);
  buf.write("RIFF", 0); buf.writeUInt32LE(36 + n * 2, 4); buf.write("WAVEfmt ", 8); buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20); buf.writeUInt16LE(1, 22); buf.writeUInt32LE(rate, 24); buf.writeUInt32LE(rate * 2, 28);
  buf.writeUInt16LE(2, 32); buf.writeUInt16LE(16, 34); buf.write("data", 36); buf.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) buf.writeInt16LE(Math.round(Math.sin((2 * Math.PI * 440 * i) / rate) * 8000), 44 + i * 2);
  return buf;
}

async function main() {
  if (!env.MODEL_API_KEY) {
    out("MODEL_API_KEY is not set.");
    process.exit(2);
  }
  const png = process.argv[2] ? readFileSync(process.argv[2]) : syntheticPng();
  const size = pngSize(png);
  const image = `data:image/png;base64,${png.toString("base64")}`;
  const wav = process.argv[3] ? new Uint8Array(readFileSync(process.argv[3])) : toneWav();
  const o = { env };
  const ok = [
    await step("chat", async () => {
      const r = await createMetaClient(env).chat({ model: "muse-spark-1.2", role: "interpret", maxTokens: 1500, reasoningEffort: "minimal", messages: [{ role: "user", content: 'Translate to Polish: "Where do I pay the fee?" Output only the translation.' }] });
      return { content: r.content, usage: r.usage };
    }),
    await step("chat stream", async () => {
      let text = "";
      let usage: unknown = null;
      for await (const c of metaChatStream({ model: "muse-spark-1.2", role: "interpret", maxTokens: 1500, reasoningEffort: "minimal", messages: [{ role: "user", content: "Say hello in Polish in one short sentence." }] }, o)) {
        if (c.type === "delta") text += c.text; else usage = c.usage;
      }
      if (!text) throw new Error("no streamed text");
      return { text, usage };
    }),
    await step("json schema", async () => {
      const r = await metaJson<{ translation: string }>({ role: "interpret", system: "Translate the user text to Polish.", user: "I have my passport.", maxTokens: 1500, schema: { type: "object", properties: { translation: { type: "string" } }, required: ["translation"] } }, o);
      return r.data;
    }),
    await step("visionGround", async () => (await visionGround({ image, targets: process.argv[2] ? ["the deadline phrase", "the case number"] : ["the dark horizontal bar"], size }, o)).boxes),
    await step("samSegment", async () => {
      const r = await samSegment({ image, boxes: [[60, 150, 560, 190]], size }, o);
      return { boxes: r.boxes.map((b) => ({ id: b.id, x1: b.x1, y1: b.y1, x2: b.x2, y2: b.y2, mask: b.mask ? `${b.mask.length} chars` : null })) };
    }),
    await step("webSearch", async () => {
      const r = await webSearch({ query: "What is the stamp duty fee for a temporary residence card in Poland? Use official sources.", maxTokens: 3000 }, o);
      return { text: r.text.slice(0, 120), citations: r.citations.slice(0, 2), searches: r.searches };
    }),
    await step("transcribeFile", async () => {
      const r = await transcribeFile({ wav, languageBias: ["Polish"] }, o);
      return { text: r.text, model: r.model };
    }),
  ];
  process.exit(ok.every(Boolean) ? 0 : 1);
}
void main();
