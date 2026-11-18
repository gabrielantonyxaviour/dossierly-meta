"use client";

import { useEffect } from "react";
import { signInUrl } from "@/lib/client/account";
import { useT } from "@/lib/i18n/client";

/** Sends a visitor without a valid session to sign-in, remembering where they were going. */
export function GoSignIn() {
  const t = useT("auth");
  useEffect(() => { window.location.replace(signInUrl()); }, []);
  return <p className="app-pad muted">{t("redirecting")}</p>;
}
