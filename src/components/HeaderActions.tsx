"use client";

import Link from "next/link";
import { useAccountState } from "@/lib/client/account";

/** Signed out: Sign in + Get started. Signed in: Open Dossierly. */
export function HeaderActions() {
  const s = useAccountState();
  return (
    <div className="site-actions">
      {s === "signed-in" ? (
        <Link href="/app" className="btn btn-primary btn-small">Open Dossierly</Link>
      ) : (
        <>
          <Link href="/signin" className="btn btn-ghost btn-small nav-signin">Sign in</Link>
          <Link href="/signup" className="btn btn-primary btn-small">Get started</Link>
        </>
      )}
    </div>
  );
}
