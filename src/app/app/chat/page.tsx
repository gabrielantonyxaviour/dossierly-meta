import { Suspense } from "react";
import { AgentChat } from "@/components/app/chat/AgentChat";

export const metadata = { title: "Ask Dossierly" };

export default function Page() {
  return <Suspense><AgentChat /></Suspense>;
}
