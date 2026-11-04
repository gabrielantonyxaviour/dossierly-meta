/** Phone verification and call permission are server-decided (onboarding's demo-call gate), never client-set. */
export function stripServerOnlyProfileFields(input: unknown): unknown {
  if (!input || typeof input !== "object" || Array.isArray(input)) return input;
  const { phone, ...rest } = input as Record<string, unknown>;
  if (!phone || typeof phone !== "object" || Array.isArray(phone)) return phone === undefined ? rest : { ...rest, phone };
  const { verified: _verified, callsEnabled: _callsEnabled, ...clientPhone } = phone as Record<string, unknown>;
  return { ...rest, phone: clientPhone };
}
