/** Offset of Europe/Warsaw at a given UTC instant, as "+01:00" / "+02:00". */
function warsawOffset(at: Date): string {
  const part = new Intl.DateTimeFormat("en-US", { timeZone: "Europe/Warsaw", timeZoneName: "longOffset" }).formatToParts(at).find((p) => p.type === "timeZoneName")?.value ?? "GMT+01:00";
  const m = /GMT([+-]\d{2}):?(\d{2})?/.exec(part);
  return m ? `${m[1]}:${m[2] ?? "00"}` : "+01:00";
}

/** Warsaw wall-clock date + time → ISO 8601 with the correct offset (DST-aware). */
export function warsawIso(date: string, time: string): string {
  const guess = new Date(`${date}T${time}:00Z`);
  const offset = warsawOffset(new Date(guess.getTime() - 60 * 60_000));
  return `${date}T${time}:00${offset}`;
}

/** "Thu 12 Nov, 09:30" in Warsaw time. */
export function warsawLabel(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Warsaw", weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
}
