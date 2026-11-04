"use client";

import { useRouter } from "next/navigation";
import { IconButton } from "@/components/ui";
import { AgentCall } from "./AgentCall";

/** /app/call: immersive voice call with the caseworker; starts at once when opened from the app. */
export function CallScreen() {
  const router = useRouter();
  const close = () => (history.length > 1 ? router.back() : router.push("/app"));
  return (
    <div className="vc-screen">
      <div className="vc-screen-bar"><IconButton icon="close" label="Close call" onClick={close} /></div>
      <AgentCall mode="agent" immersive autoStart />
    </div>
  );
}
