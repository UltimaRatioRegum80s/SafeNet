import { useEffect, useMemo, useRef } from "react";
import { Eye, Navigation } from "lucide-react";
import { cn } from "@/lib/utils";
import { useIncidents24hInfinite } from "@/features/incidents/useIncidents24hInfinite";
import { SeverityIcon, SeverityChip, severityColorClass } from "@/components/SeverityUI";
import NNImage from "@/components/NNImage";
import { Flag } from "lucide-react";

// Time utility function
function timeAgoFromTimestamp(timestamp: number) {
  const diff = (Date.now() - timestamp) / 1000;
  if (diff < 60) return `${Math.floor(diff)}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return new Date(timestamp).toLocaleDateString();
}

export default function RecentIncidentsPanel() {
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useIncidents24hInfinite();

  const items = useMemo(
    () => (data?.pages ?? []).flatMap(p => p.items ?? []),
    [data]
  );

  // Intersection observer to trigger next page
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    
    const io = new IntersectionObserver((entries) => {
      const [e] = entries;
      if (e.isIntersecting && hasNextPage && !isFetchingNextPage) {
        fetchNextPage();
      }
    }, { 
      root: document.querySelector(".custom-scroll") as Element | null ?? undefined, 
      rootMargin: "120px" 
    });
    
    io.observe(el);
    return () => io.disconnect();
  }, [fetchNextPage, hasNextPage, isFetchingNextPage]);

  return (
    <section className="card h-full overflow-hidden">
      <header className="sticky top-0 z-10 card-header/ghost bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Eye className="w-4 h-4" />
          Recent Incidents
          <span className="ml-2 text-xs text-muted-foreground">(last 24h)</span>
        </h3>
      </header>

      <div className="card-content p-3 pt-2 h-full overflow-y-auto pr-2 custom-scroll">
        {!items.length ? (
          <div className="text-muted-foreground text-sm">No incidents in the last 24h.</div>
        ) : (
          <ul className="space-y-2">
            {items.map((i) => (
              <li key={i.id}>
                <article
                  className={cn(
                    "w-full text-left p-3 mb-2 rounded-2xl border transition-all duration-200 cursor-pointer",
                    // Enhanced glass styling
                    "backdrop-blur-md bg-white/[.02] border border-white/5",
                    "hover:bg-white/[.04] hover:shadow-md hover:border-white/10"
                  )}
                >
                  <div className="flex items-start gap-3">
                    <div className={`mt-1 size-3 rounded-full ${severityColorClass(i.severity as any)}`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2">
                          <SeverityIcon sev={i.severity as any} />
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
                          {timeAgoFromTimestamp(new Date(i.createdAt).getTime())}
                        </span>
                      </div>
                      <h4 className="mt-2 text-sm font-medium leading-snug text-white">{i.title}</h4>
                      {i.description && (
                        <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{i.description}</p>
                      )}
                      {i.latitude != null && i.longitude != null && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            const map = (window as any).__nnMap;
                            if (map) {
                              map.flyTo([Number(i.latitude), Number(i.longitude)], 17, { animate: true, duration: 0.8 });
                            }
                          }}
                          className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-blue-500/30 bg-blue-500/10 px-2.5 py-1 text-[11px] font-semibold text-blue-400 transition-colors hover:bg-blue-500/20 hover:text-blue-300"
                          aria-label="Show incident location on map"
                        >
                          <Navigation className="h-3 w-3" />
                          Show on map
                        </button>
                      )}
                    </div>
                  </div>
                </article>
              </li>
            ))}
          </ul>
        )}

        {/* Load-more sentinel */}
        <div ref={sentinelRef} className="h-8" />
        {isFetchingNextPage && (
          <div className="py-3 text-center text-xs text-muted-foreground">Loading more…</div>
        )}
        {!hasNextPage && items.length > 0 && (
          <div className="py-3 text-center text-xs text-muted-foreground">End of last 24 hours</div>
        )}
      </div>
    </section>
  );
}