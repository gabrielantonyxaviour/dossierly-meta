import type { CaseSnapshot } from "@/lib/case/types";
import type { ResidenceAction } from "@/lib/residence/actions";
import { call, type ApiResult } from "./api";

/** POST /api/case/residence: one residence action, answered with the whole updated case. */
export const residenceAction = (a: ResidenceAction): Promise<ApiResult<CaseSnapshot>> =>
  call<CaseSnapshot>("/api/case/residence", { method: "POST", body: JSON.stringify(a) });
