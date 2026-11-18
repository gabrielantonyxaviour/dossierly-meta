import type { Metadata } from "next";
import { AdminScreen } from "@/components/admin/AdminScreen";
import { GoSignIn } from "@/components/auth/GoSignIn";
import { isAdminAccount } from "@/lib/admin/auth";
import { currentAccount } from "@/lib/server/account";
import { getEnv } from "@/lib/server/env";

export const metadata: Metadata = { title: "Admin", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

/** Server-gated: no session goes to sign-in; a non-admin sees a plain 403 and no admin data is ever sent. */
export default async function AdminPage() {
  const account = await currentAccount();
  if (!account) return <GoSignIn />;
  if (!(await isAdminAccount(getEnv(), account.accountId))) {
    return <main className="ad-denied" style={{ padding: 32, color: "var(--ink-2)" }}><h1 style={{ fontSize: "1.5rem" }}>403</h1><p>This page is not available for your account.</p></main>;
  }
  return <main style={{ minHeight: "100dvh", background: "var(--bg)" }}><AdminScreen /></main>;
}
