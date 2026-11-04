"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { safeNext } from "@/lib/client/account";
import { getMe } from "@/lib/client/api";
import { EmailCodeForm } from "./EmailCodeForm";
import { Logo } from "../Logo";

type Mode = "signup" | "signin";

/** One email-code flow for creating an account and returning to it. */
export function AuthPanel({ mode }: { mode: Mode }) {
  const router = useRouter();
  const params = useSearchParams();
  const next = () => {
    const back = params.get("next");
    if (back) return router.replace(safeNext(back));
    const start = params.get("start");
    const q = new URLSearchParams();
    if (start === "sample") q.set("start", "sample");
    const s = q.toString();
    router.replace(s ? `/app?${s}` : "/app");
  };

  // Email accounts can skip the form; earlier accounts can still verify an email.
  useEffect(() => {
    let active = true;
    void getMe().then((r) => { if (active && r.ok && r.data.accountKind === "email") next(); });
    return () => { active = false; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="auth">
      <div className="auth-card">
        <Link href="/" className="logo-link auth-brand" aria-label="Dossierly home"><Logo size={24} /></Link>
        <EmailCodeForm heading={mode === "signup" ? "Create your account" : "Sign in"} onVerified={next} />
        <p className="auth-legal tiny muted">
          By continuing, you agree to our <Link href="/legal/terms">Terms</Link> and <Link href="/legal/privacy">Privacy Policy</Link>.
        </p>
      </div>
    </div>
  );
}
