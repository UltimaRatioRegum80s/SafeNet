/**
 * GroupFilterTabs - Filter incidents by taxonomy v2 groups
 * 
 * Allows users to filter the feed by:
 * - All (no filter)
 * - Services (everyday issues)
 * - Nabor Note (community observations)
 * - Emergency (urgent situations)
 * - Critical (life-threatening)
 * 
 * Phase 3A polish:
 * - 44px min touch targets for mobile
 * - Enhanced active state visibility
 * - Clear button when filter is active
 */

import { X } from "lucide-react";
import { 
  TAXONOMY_GROUPS, 
  TAXONOMY_GROUP_ORDER, 
  type TaxonomyGroupId 
} from "@/features/report/taxonomyV2";
import { cn } from "@/lib/utils";

export type GroupFilter = 'all' | TaxonomyGroupId;

interface GroupFilterTabsProps {
  value: GroupFilter;
  onChange: (value: GroupFilter) => void;
  className?: string;
}

const GROUP_ICONS: Record<TaxonomyGroupId, string> = {
  services: '🟧',
  nabor_note: '🔵',
  emergency: '❌',
  critical: '🔴',
};

export default function GroupFilterTabs({ 
  value, 
  onChange, 
  className 
}: GroupFilterTabsProps) {
  const hasActiveFilter = value !== 'all';
  
  return (
    <div className={cn("flex items-center gap-2 overflow-x-auto px-3 py-2 hide-scrollbar", className)}>
      {/* All filter */}
      <button
        onClick={() => onChange('all')}
        className={cn(
          "flex-shrink-0 min-h-[44px] px-4 py-2 rounded-full text-sm font-medium transition-all",
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-black/20 dark:focus-visible:ring-white/50",
          "active:scale-95",
          value === 'all'
            ? "bg-black text-white dark:bg-white dark:text-black shadow-lg ring-2 ring-black/20 dark:ring-white/30"
            : "bg-gray-200 text-gray-700 hover:bg-gray-300 hover:text-gray-900 dark:bg-white/10 dark:text-white/70 dark:hover:bg-white/20 dark:hover:text-white"
        )}
        data-testid="filter-all"
      >
        All
      </button>
      
      {/* Group filters */}
      {TAXONOMY_GROUP_ORDER.map((groupId) => {
        const group = TAXONOMY_GROUPS[groupId];
        const isActive = value === groupId;
        
        return (
          <button
            key={groupId}
            onClick={() => onChange(groupId)}
            className={cn(
              "flex-shrink-0 min-h-[44px] px-4 py-2 rounded-full text-sm font-medium transition-all",
              "flex items-center gap-1.5",
              "focus:outline-none focus-visible:ring-2 focus-visible:ring-black/20 dark:focus-visible:ring-white/50",
              "active:scale-95",
              isActive
                ? "bg-black text-white dark:bg-white dark:text-black shadow-lg ring-2 ring-black/20 dark:ring-white/30"
                : "bg-gray-200 text-gray-700 hover:bg-gray-300 hover:text-gray-900 dark:bg-white/10 dark:text-white/70 dark:hover:bg-white/20 dark:hover:text-white"
            )}
            data-testid={`filter-${groupId}`}
          >
            <span>{GROUP_ICONS[groupId]}</span>
            <span className="whitespace-nowrap">{group.label}</span>
          </button>
        );
      })}
      
      {/* Clear button - appears when a filter is active */}
      {hasActiveFilter && (
        <button
          onClick={() => onChange('all')}
          className={cn(
            "flex-shrink-0 min-h-[44px] min-w-[44px] rounded-full",
            "flex items-center justify-center gap-1",
            "bg-red-100 text-red-600 hover:bg-red-200 hover:text-red-700 dark:bg-red-500/20 dark:text-red-300 dark:hover:bg-red-500/30 dark:hover:text-red-200",
            "transition-all active:scale-95",
            "focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400/50"
          )}
          data-testid="filter-clear"
          aria-label="Clear filter"
        >
          <X size={18} />
        </button>
      )}
      
      <style>{`
        .hide-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .hide-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>
    </div>
  );
}
