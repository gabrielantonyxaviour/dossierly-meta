import { redirect } from "next/navigation";

/** Letters are read through Look now (photo or screenshot → outlines → cited deadline). */
export default function Page() {
  redirect("/app/look");
}
