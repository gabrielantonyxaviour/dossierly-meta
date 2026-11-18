import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthPanel } from "@/components/auth/AuthPanel";
import { getT } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT("auth");
  return { title: t("signinTitle"), robots: { index: false } };
}

export default function SignInPage() {
  return <Suspense><AuthPanel mode="signin" /></Suspense>;
}
