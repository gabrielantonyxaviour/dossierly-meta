/** Outgoing sender addresses; each must be in the larinova env's send_email allowed_sender_addresses (wrangler.jsonc). */
export const SENDERS = {
  /** Sign-in codes and other account mail. */
  account: "no-reply@dossierly.larinova.com",
  /** Letter and deadline notices to users. */
  alerts: "alerts@dossierly.larinova.com",
  /** Generated sample official letters (demo mode only). */
  sampleOffice: "wsc@dossierly.larinova.com",
} as const;
