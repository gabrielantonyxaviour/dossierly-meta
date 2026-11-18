import type { Metadata } from "next";
import { getT } from "@/lib/i18n/server";
import { NotificationsScreen } from "@/components/app/notifications/NotificationsScreen";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT("notifications");
  return { title: t("metaTitle") };
}

export default function Page() {
  return <NotificationsScreen />;
}
