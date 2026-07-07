import { AlertTriangle, MapPin, Siren, HandHelping } from "lucide-react";
import type { Severity } from "@/lib/severity";

export const severityColorClass = (s: Severity) =>
  ({ low: "bg-yellow-500", medium: "bg-amber-500", high: "bg-red-500", critical: "bg-red-700", emergency: "bg-red-600" }[s]);

export function SeverityChip({ sev }: { sev: Severity }) {
  return (
    <span className="px-2 py-0.5 rounded-full bg-white/10 border border-white/10 text-[10px] font-semibold">
      {sev.toUpperCase()}
    </span>
  );
}

export function SeverityIcon({ sev, className="w-4 h-4 text-white/80" }:{ sev: Severity; className?: string }) {
  switch (sev) {
    case "critical":
    case "emergency": return <Siren className={className} />;
    case "high": return <AlertTriangle className={className} />;
    case "medium": return <MapPin className={className} />;
    default: return <HandHelping className={className} />;
  }
}