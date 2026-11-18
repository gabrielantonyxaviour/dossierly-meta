import type { CaseSnapshot, DOC_KINDS, PermitType } from "@/lib/case/types";
import { feeLines, isGround } from "./model";

/*
 * The Prepare checklist: what MOS needs for the person's ground, plus one pair of fee transfers per person.
 * Item text lives in the "residence" message namespace under check_<id> / check_<id>Sub. Ticks are stored as ids in
 * profile.checklistDone; some items tick themselves when the matching document is already in the case.
 * Sources: research A (MOS filing, employer annex art. 106c ust. 3), B (documents, fees, family art. 159).
 */

export type CheckGroup = "accounts" | "documents" | "employer" | "family" | "fees";
export type CheckItem = {
  id: string;
  group: CheckGroup;
  /** Message key stem: check_<key> and check_<key>Sub. */
  key: string;
  vars?: Record<string, string | number>;
  /** Opens a tool that helps with this item. */
  href?: string;
  /** Ticked because a matching document is in the case (cannot be unticked here). */
  auto?: boolean;
  done: boolean;
};

type DocKind = (typeof DOC_KINDS)[number];
const AUTO: Partial<Record<string, DocKind>> = { photo: "photo", passport: "passport", insurance: "health_insurance", housing: "rental_agreement", university: "university_certificate" };

type Base = Omit<CheckItem, "done" | "auto">;

function groundItems(ground: PermitType | null): Base[] {
  const doc = (key: string, href?: string): Base => ({ id: key.replace(/[A-Z]/g, (m) => `_${m.toLowerCase()}`), group: "documents", key, href });
  const common: Base[] = [doc("photo", "/app/photo-check"), doc("passport"), doc("insurance"), doc("housing")];
  switch (isGround(ground) ? ground : "temporary_residence_work") {
    case "temporary_residence_work":
      return [...common, doc("contract"), { id: "annex", group: "employer", key: "annex" }];
    case "temporary_residence_blue_card":
      return [...common, doc("contract"), doc("qualifications"), { id: "annex", group: "employer", key: "annex" }];
    case "temporary_residence_study":
      return [...common, doc("university"), doc("means")];
    case "temporary_residence_family":
      return [...common, doc("sponsorCard"), doc("income"), doc("civil"), doc("translations")];
  }
}

/** All items for this case, with their done state. */
export function checklist(c: CaseSnapshot): CheckItem[] {
  const p = c.profile;
  const household = p.household ?? [];
  const items: Base[] = [
    { id: "pesel", group: "accounts", key: "pesel" },
    { id: "trusted", group: "accounts", key: "trusted" },
    { id: "edelivery", group: "accounts", key: "edelivery" },
    ...groundItems(p.permitType),
  ];
  if (household.length) {
    items.push({ id: "fam_civil", group: "family", key: "famCivil" }, { id: "fam_translate", group: "family", key: "famTranslate" });
    items.push({ id: "fam_income", group: "family", key: "famIncome", vars: { n: household.length + 1 } });
  }
  for (const f of feeLines({ name: p.fullName ?? "", permitType: p.permitType }, household)) {
    const who = f.memberId === "me" ? "" : f.who;
    items.push({ id: `fee_stamp_${f.memberId}`, group: "fees", key: who ? "feeStampFor" : "feeStamp", vars: { amount: f.stamp, name: who } });
    items.push({ id: `fee_card_${f.memberId}`, group: "fees", key: who ? "feeCardFor" : "feeCard", vars: { amount: f.card, name: who } });
  }
  const ticked = new Set(p.checklistDone ?? []);
  const have = new Set(c.documents.filter((d) => d.status === "have").map((d) => d.kind));
  return items.map((it) => {
    const kind = AUTO[it.id];
    const auto = !!kind && have.has(kind);
    return { ...it, auto, done: auto || ticked.has(it.id) };
  });
}

export const GROUP_ORDER: CheckGroup[] = ["accounts", "documents", "employer", "family", "fees"];

/** Ids a person may tick: the fixed ones and one fee pair per person (ids are checked server-side too). */
export const CHECK_ID = /^(pesel|trusted|edelivery|photo|passport|insurance|housing|contract|annex|qualifications|university|means|sponsor_card|income|civil|translations|fam_civil|fam_translate|fam_income|fee_(stamp|card)_[a-z0-9]{1,40})$/;
