import { useReportPanel } from "@/features/report/useReportPanel";
import ReportPanel from "@/features/report/ReportPanel";
import CategorySheetsV2 from "@/features/report/CategorySheetsV2";
import QuickReportCard from "@/features/report/QuickReportCard";
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Shield } from 'lucide-react';
import { useLocation } from "wouter";
import { useEffect, useRef } from "react";
import { track } from "@/lib/analytics";
import { 
  ALL_TAXONOMY_TYPES, 
  TAXONOMY_TYPES_BY_ID,
  TAXONOMY_GROUPS,
  getGroupCardClasses,
  getGroupBadgeClasses,
  deriveSeverityFromGroup,
  resolveToV2Type,
  type TaxonomyType
} from "@/features/report/taxonomyV2";
import { useQuickReportStore } from "@/state/useQuickReportStore";

function getQuery(search: string) {
  const q = new URLSearchParams(search.replace(/^\?/, ""));
  return Object.fromEntries(q.entries());
}

export default function ReportIncident() {
  const { openWith } = useReportPanel();
  const [path, setLocation] = useLocation();
  const search = typeof window !== "undefined" ? window.location.search : "";
  const query = getQuery(search);
  const openedRef = useRef(false);
  const openQuickReport = useQuickReportStore((s) => s.open);

  // Open on load if ?type=<id> with duplicate guard (supports both v1 and v2 type IDs)
  useEffect(() => {
    if (!openedRef.current && query.type) {
      const typeId = query.type;
      const v2Type = resolveToV2Type(typeId);
      if (v2Type) {
        const severity = deriveSeverityFromGroup(v2Type.groupId);
        openQuickReport({ type: v2Type.id, severity });
        openedRef.current = true;
        track("report_start", { type: v2Type.id, source: "deep_link" });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query.type]);

  function selectType(type: TaxonomyType) {
    const url = new URL(window.location.href);
    url.searchParams.set("type", type.id);
    window.history.replaceState({}, "", url.toString());
    
    const severity = deriveSeverityFromGroup(type.groupId);
    openQuickReport({ type: type.id, severity });
    track("report_start", { type: type.id, groupId: type.groupId, source: "type_grid" });
  }

  return (
    <div>
      {/* Desktop view: v2 taxonomy grid grouped by category */}
      <div className="hidden lg:block">
        <div className="max-w-5xl mx-auto p-4 space-y-6">
          {Object.entries(TAXONOMY_GROUPS).map(([groupId, group]) => {
            const types = ALL_TAXONOMY_TYPES.filter(t => t.groupId === groupId);
            return (
              <Card key={groupId} className={getGroupCardClasses(groupId as any)}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <span className="text-xl">{group.emoji}</span>
                    {group.label}
                    <span className={`ml-2 px-2 py-0.5 text-xs font-medium rounded-full ${getGroupBadgeClasses(groupId as any)}`}>
                      {group.description}
                    </span>
                  </CardTitle>
                </CardHeader>
                
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
                    {types.map((type) => (
                      <button
                        key={type.id}
                        className="p-4 rounded-xl transition-all duration-200 border-2 hover:scale-105 transform relative min-h-[100px] tap-target bg-white/50 dark:bg-black/20"
                        style={{ 
                          borderColor: type.color,
                          boxShadow: `0 2px 8px ${type.color}30`
                        }}
                        onClick={() => selectType(type)}
                        data-testid={`incident-${type.id}`}
                        aria-label={`Report ${type.label}`}
                      >
                        <div className="flex flex-col items-center gap-2">
                          <div 
                            className="w-12 h-12 rounded-full flex items-center justify-center text-xl font-bold"
                            style={{ backgroundColor: `${type.color}30` }}
                          >
                            {type.isCustom ? "+" : type.label.charAt(0)}
                          </div>
                          <div className="text-sm font-medium text-center text-slate-700 dark:text-slate-300">
                            {type.label}
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Mobile & tablet: v2 group-based carousel */}
      <div className="lg:hidden">
        <CategorySheetsV2 />
      </div>

      {/* Shared ReportPanel renders here */}
      <ReportPanel />
      
      {/* Quick Report Card for mobile/tablet flow */}
      <QuickReportCard />
    </div>
  );
}