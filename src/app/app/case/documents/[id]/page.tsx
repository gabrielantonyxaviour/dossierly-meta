import { DocumentDetail } from "@/components/app/case/DocumentDetail";

export const metadata = { title: "Document" };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <DocumentDetail id={id} />;
}
