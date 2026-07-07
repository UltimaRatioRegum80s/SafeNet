export function toLocalDateKey(d: string | Date) {
  const dt = typeof d === "string" ? new Date(d) : d;
  // yyyy-mm-dd in local time
  return [
    dt.getFullYear(),
    String(dt.getMonth() + 1).padStart(2, "0"),
    String(dt.getDate()).padStart(2, "0"),
  ].join("-");
}

export function relativeDateLabel(d: string | Date, locale = undefined) {
  const dt = typeof d === "string" ? new Date(d) : d;

  const today = new Date();
  const yday = new Date();
  yday.setDate(today.getDate() - 1);

  const sameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();

  if (sameDay(dt, today)) return "Today";
  if (sameDay(dt, yday)) return "Yesterday";

  return dt.toLocaleDateString(locale, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}