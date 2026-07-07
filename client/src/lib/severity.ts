export type Severity = "low" | "medium" | "high" | "critical" | "emergency";

// If your API already has severity, map directly; otherwise adapt from priority/level/tags:
export function toSeverity(input: string | number | undefined): Severity {
  if (typeof input === "number") {
    if (input >= 90) return "critical";
    if (input >= 60) return "high";
    if (input >= 30) return "medium";
    return "low";
  }
  const s = String(input ?? "").toLowerCase();
  if (s === "critical") return "critical";
  if (["emergency", "red"].includes(s)) return "emergency";
  if (["high", "urgent", "orange"].includes(s)) return "high";
  if (["medium", "warn", "amber"].includes(s)) return "medium";
  return "low";
}

export const severityColor = (s: Severity) =>
  ({ low: "bg-yellow-500", medium: "bg-amber-500", high: "bg-red-500", critical: "bg-red-700", emergency: "bg-red-600" }[s]);

export const severityHex = (s: Severity) =>
  ({ low: "#eab308", medium: "#f59e0b", high: "#ef4444", critical: "#b91c1c", emergency: "#ef4444" }[s]);

export const severityLabel = (s: Severity) => s.toUpperCase();