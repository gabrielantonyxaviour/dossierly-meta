import { Suspense } from "react";
import { CaseScreen } from "@/components/app/case/CaseScreen";

export const metadata = { title: "Your case" };

export default function Page() {
  return <Suspense><CaseScreen /></Suspense>;
}
