import { DeadlineDetail } from "@/components/app/case/DeadlineDetail";

export const metadata = { title: "Deadline" };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <DeadlineDetail id={id} />;
}
