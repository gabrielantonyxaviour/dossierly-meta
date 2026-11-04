export type FetchLike = (url: string, init?: RequestInit) => Promise<Response>;

export interface VatInfo {
  name: string; nip: string; regon: string | null; krs: string | null; statusVat: string | null;
  address: string | null; registrationLegalDate: string | null; accountCount: number; requestId: string | null;
}
export interface KrsInfo {
  name: string; legalForm: string | null; seat: string | null; address: string | null;
  registeredAt: string | null; board: string[]; krsNumber: string; nip: string | null;
}
export type Verdict = {
  status: "active" | "inactive" | "not_found" | "unavailable";
  lines: string[];
  checkedAt: string;
  sources: { label: string; url: string }[];
};
export interface RegistryResult {
  query: { nip: string | null; krs: string | null };
  vat: VatInfo | null;
  krs: Omit<KrsInfo, "nip"> | null;
  verdict: Verdict;
}
