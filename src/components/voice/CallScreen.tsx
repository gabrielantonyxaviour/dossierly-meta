"use client";

import { useRouter } from "next/navigation";
import { AgentCall } from "./AgentCall";

/** /app/call: full-screen voice call with the caseworker; starts at once when opened from the app. */
export function CallScreen() {
  const router = useRouter();
  const close = () => (history.length > 1 ? router.back() : router.push("/app"));
  return <AgentCall mode="agent" immersive autoStart onClose={close} />;
}
