import { LookFlow } from "@/components/app/look/LookFlow";

export const metadata = { title: "Look" };

/** `?doc=<id>` and `?look=<id>` open straight into a loading state, so the Look home never paints first. */
export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const q = await searchParams;
  const boot = typeof q.doc === "string" && /^[A-Za-z0-9_-]{1,80}$/.test(q.doc) ? "doc"
    : typeof q.look === "string" && /^lk_[A-Za-z0-9]{8,40}$/.test(q.look) ? "look" : null;
  return <LookFlow boot={boot} />;
}
