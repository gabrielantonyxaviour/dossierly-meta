import { redirect } from "next/navigation";

/** The earlier Meet table mode is replaced by Counter. */
export default function Page() {
  redirect("/app/counter");
}
