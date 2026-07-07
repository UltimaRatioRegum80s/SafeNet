import React, { useState } from "react";
import { timeAgo } from "@/lib/timeAgo";
import { SeverityIcon, SeverityChip, severityColorClass } from "@/components/SeverityUI";
import { useIncidentStore } from "@/state/useIncidentStore";
import NNImage from "@/components/NNImage";
import { Flag } from "lucide-react";
import ReportAbuseDialog from "./ReportAbuseDialog";
import { cn } from "@/lib/utils";

// Time utility function
function timeAgoFromTimestamp(timestamp: number) {
  const diff = (Date.now() - timestamp) / 1000;
  if (diff < 60) return `${Math.floor(diff)}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return new Date(timestamp).toLocaleDateString();
}

export interface IncidentMarker {
  id: string;
  type: "crime" | "safety_alert" | "suspicious" | "emergency";
  title: string;
  description?: string;
  position: { lat: number; lng: number };
  severity: "low" | "medium" | "high" | "critical" | "emergency";
  created_at: number; // secs or ms
  photos?: string[]; // Photo URLs
}

export default function IncidentList({
  items,
  onSelect,
  dense = false,
}: {
  items: IncidentMarker[];
  onSelect: (id: string) => void;
  dense?: boolean;
}) {
  const selectedId = useIncidentStore((s) => s.selectedId);
  const [reportDialogOpen, setReportDialogOpen] = useState(false);
  const [reportingIncidentId, setReportingIncidentId] = useState<string | null>(null);

  return (
    <div className={`px-2 pb-3 overflow-y-auto ${dense ? "space-y-1" : ""}`}>
      {items.map((i) => {
        const isActive = i.id === selectedId;
        const onKeyActivate = (e: React.KeyboardEvent) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onSelect(i.id);
          }
        };

        return (
          <div
            key={i.id}
            role="button"
            tabIndex={0}
            onClick={() => onSelect(i.id)}
            onKeyDown={onKeyActivate}
            aria-selected={isActive}
            className={cn(
              `w-full text-left ${dense ? "p-3" : "p-3"} mb-2 rounded-2xl border transition-all duration-200 cursor-pointer`,
              // Enhanced glass styling
              "backdrop-blur-md bg-white/[.02] border border-white/5",
              "hover:bg-white/[.04] hover:shadow-md hover:border-white/10",
              // Active states
              isActive 
                ? "bg-white/[.08] border-white/20 shadow-lg" 
                : ""
            )}
          >
            <div className="flex items-start gap-3">
              <div className={`mt-1 size-3 rounded-full ${severityColorClass(i.severity)}`} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    <SeverityIcon sev={i.severity} />
                    <span className={cn(
                      "text-[10px] font-semibold px-2 py-0.5 rounded-full",
                      i.severity === "critical" ? "bg-red-700/20 text-red-400 ring-1 ring-red-600/30" :
                      i.severity === "high" ? "bg-red-500/15 text-red-400 ring-1 ring-red-500/20" :
                      i.severity === "medium" ? "bg-amber-500/15 text-amber-400 ring-1 ring-amber-500/20" :
                      "bg-yellow-500/15 text-yellow-400 ring-1 ring-yellow-500/20"
                    )}>
                      {i.severity}
                    </span>
                  </div>
                  <span className="ml-auto text-xs text-muted-foreground/70">
                    {timeAgoFromTimestamp(i.created_at)}
                  </span>
                </div>
                <h4 className="mt-2 text-sm font-medium leading-snug text-white">{i.title}</h4>
                {i.description && (
                  <div className="text-sm text-foreground/70 dark:text-white/70 line-clamp-2">{i.description}</div>
                )}
                {i.photos && i.photos.length > 0 && (
                  <div className="mt-2 flex gap-1 overflow-x-auto">
                    {i.photos.slice(0, 3).map((photoUrl, idx) => (
                      <button
                        key={idx}
                        type="button"
                        className="w-12 h-12 rounded object-cover flex-shrink-0 bg-muted/20 dark:bg-white/10 focus:ring-2 focus:ring-blue-500 focus:outline-none tap-target"
                        aria-label={`Open photo ${idx + 1} of ${i.photos?.length || 0}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          // TODO: Open lightbox gallery
                          console.log('Open photo:', photoUrl);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            e.stopPropagation();
                            console.log('Open photo:', photoUrl);
                          }
                        }}
                      >
                        <NNImage
                          src={photoUrl}
                          alt={`Incident photo ${idx + 1}`}
                          className="w-full h-full rounded object-cover"
                        />
                      </button>
                    ))}
                    {i.photos.length > 3 && (
                      <div className="w-12 h-12 rounded bg-muted/40 dark:bg-white/20 flex items-center justify-center text-xs text-foreground/80 dark:text-white/80 flex-shrink-0">
                        +{i.photos.length - 3}
                      </div>
                    )}
                  </div>
                )}
                <div className="mt-1 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground dark:text-white/60">
                    <SeverityChip sev={i.severity} />
                    <span>{timeAgoFromTimestamp(i.created_at)}</span>
                    {i.photos && i.photos.length > 0 && (
                      <span className="text-blue-500 dark:text-blue-400">📸 {i.photos.length}</span>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setReportingIncidentId(i.id);
                      setReportDialogOpen(true);
                    }}
                    className="p-1 rounded hover:bg-muted/40 dark:hover:bg-white/10 opacity-60 hover:opacity-100 transition-opacity text-muted-foreground dark:text-white/60"
                    aria-label="Report this incident"
                    data-testid={`button-report-${i.id}`}
                  >
                    <Flag className="w-3 h-3" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })}
      {items.length === 0 && (
        <div className="p-6 text-center text-white/60">No incidents.</div>
      )}
      
      {/* Abuse Report Dialog */}
      {reportingIncidentId && (
        <ReportAbuseDialog
          open={reportDialogOpen}
          onOpenChange={setReportDialogOpen}
          incidentId={reportingIncidentId}
        />
      )}
    </div>
  );
}