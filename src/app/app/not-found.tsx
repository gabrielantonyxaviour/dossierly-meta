import { ButtonLink, EmptyState } from "@/components/ui";

export default function NotFound() {
  return (
    <div className="sh-page">
      <div style={{ height: 56 }} />
      <EmptyState icon="info" title="This part isn’t here yet" action={<ButtonLink href="/app" size="sm" icon="home">Back to home</ButtonLink>}>
        It may still be on its way to this preview. Everything in your case is safe.
      </EmptyState>
    </div>
  );
}
