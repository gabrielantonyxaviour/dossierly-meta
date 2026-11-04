import { LookFlow } from "@/components/app/look/LookFlow";

export const metadata = { title: "Look" };

/** `?doc=<id>` opens straight into "opening the letter" so the Look home never paints first. */
export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const doc = (await searchParams).doc;
  return <LookFlow fromDocument={typeof doc === "string" && /^[A-Za-z0-9_-]{1,80}$/.test(doc)} />;
}
