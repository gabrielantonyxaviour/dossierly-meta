import type { T } from "@/lib/i18n/translate";

/* Provider names are brands and stay as written; the purpose and permission copy is translated by key. */
export const providers = [
  { id: "gmail", key: "gmail", title: "Gmail", group: "Mail", logo: "gmail.png", reference: "https://docs.composio.dev/toolkits/gmail" },
  { id: "outlook", key: "outlook", title: "Microsoft Outlook", group: "Mail", logo: "outlook.png", reference: "https://docs.composio.dev/toolkits/outlook" },
  { id: "calendar", key: "gcal", title: "Google Calendar", group: "Calendar", logo: "google-calendar.png", reference: "https://docs.composio.dev/toolkits/googlecalendar" },
  { id: "microsoft-calendar", key: "mscal", title: "Microsoft Calendar", group: "Calendar", logo: "microsoft-calendar.png", reference: "https://docs.composio.dev/toolkits/outlook" },
  { id: "apple-calendar", key: "applecal", title: "Apple Calendar", group: "Calendar", logo: "apple-calendar.png", reference: "https://support.apple.com/en-ie/guide/calendar/-icl1023/mac" },
] as const;
export type Tool = (typeof providers)[number]["id"];
export type Provider = (typeof providers)[number];
export const providerName = (tool: Tool) => providers.find((provider) => provider.id === tool)!.title;
export const providerGroup = (tool: Tool) => providers.find((provider) => provider.id === tool)!.group;
export const groupLabel = (group: string, t: T) => t(group === "Mail" ? "groupMail" : "groupCalendar");
export const providerCopy = (provider: Provider, t: T) => ({
  purpose: t(`${provider.key}Purpose`), permission: t(`${provider.key}Permission`), boundary: t(`${provider.key}Boundary`),
});
