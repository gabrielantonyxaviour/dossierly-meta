import { AgentCall } from "@/components/voice/AgentCall";

export const metadata = { title: "Talk to Dossierly" };

export default function Page() {
  return (
    <div className="app-pad">
      <AgentCall mode="agent" />
    </div>
  );
}
