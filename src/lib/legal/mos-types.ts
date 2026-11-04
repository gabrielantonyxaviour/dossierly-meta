/*
 * Shapes for the MOS (mos.cudzoziemcy.gov.pl) temporary-residence form data.
 *
 * caseKey vocabulary (where the value for a field comes from in the user's case; null = ask the user):
 *   profile.fullName | profile.city | profile.organisation | profile.arrivalDate | profile.phone
 *   facts.caseNumber
 *   documents.<docKind>.<field>, docKind = passport | health_insurance | rental_agreement | university_certificate
 *     passport fields: surname, givenNames, birthDate, birthPlace, sex, nationality, number, issueDate, expiryDate, issuingAuthority
 *     health_insurance fields: insurer, policyNumber, validTo
 *     rental_agreement fields: address, city, postalCode, monthlyRent
 * Dates in `example` use the form's own order (year, month, day) written as YYYY-MM-DD.
 */
export interface MosField {
  id: string;
  /** Exact Polish label as printed on the official form (Dz. U. 2026 poz. 553, załącznik nr 1). */
  labelPl: string;
  labelEn: string;
  caseKey: string | null;
  /** What Arjun Raman (fictional persona) would type. */
  example: string;
  /** What to type and in which format. */
  hint: string;
  required: boolean;
}

export interface MosSection {
  id: string;
  titlePl: string;
  titleEn: string;
  fields: MosField[];
}

export interface MosAttachment {
  id: string;
  titleEn: string;
  titlePl: string;
  detail: string;
  /** "mandatory": the Act requires it with the application. "payment": proof of a fee. "supporting": documents that back up the data (art. 106d ust. 2) and that the voivode may ask for (art. 106f). */
  kind: "mandatory" | "payment" | "supporting";
  spec?: string;
  sourceUrl: string;
  verified: boolean;
  note?: string;
}

export interface MosFee {
  id: string;
  titleEn: string;
  amountPln: number;
  detail: string;
  sourceUrl: string;
  verified: boolean;
  note?: string;
}

export const f = (
  id: string,
  labelPl: string,
  labelEn: string,
  caseKey: string | null,
  example: string,
  hint: string,
  required = true,
): MosField => ({ id, labelPl, labelEn, caseKey, example, hint, required });
