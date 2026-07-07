/**
 * CollapsibleCategoryFilter - Compact filter button that opens a centered modal
 * 
 * Designed to minimize screen real estate on the map while maintaining filter functionality.
 * - Shows a single filter icon button
 * - Opens a centered modal with category options when tapped
 */

import { useState, useEffect, useCallback } from 'react';
import { Filter, Check, X } from 'lucide-react';
import { 
  TAXONOMY_GROUPS, 
  TAXONOMY_GROUP_ORDER, 
  type TaxonomyGroupId 
} from "@/features/report/taxonomyV2";
import { cn } from "@/lib/utils";

export type GroupFilter = 'all' | TaxonomyGroupId;

interface CollapsibleCategoryFilterProps {
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

export function CollapsibleCategoryFilter({ 
  value, 
  onChange, 
  className 
}: CollapsibleCategoryFilterProps) {
  const [isOpen, setIsOpen] = useState(false);
  
  const hasActiveFilter = value !== 'all';

  const handleClose = useCallback(() => {
    setIsOpen(false);
  }, []);

  const handleSelect = (filter: GroupFilter) => {
    onChange(filter);
    setIsOpen(false);
  };

  const handleBackdropClick = (e: { target: EventTarget | null; currentTarget: EventTarget | null }) => {
    if (e.target === e.currentTarget) {
      setIsOpen(false);
    }
  };
  
  useEffect(() => {
    if (!isOpen) return;
    
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleClose();
      }
    };
    
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, handleClose]);

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className={cn(
          "h-14 w-14 grid place-items-center rounded-2xl shadow-lg transition-all duration-200",
          "active:scale-95",
          hasActiveFilter
            ? "bg-blue-600 text-white ring-2 ring-blue-400"
            : "bg-gray-800/95 dark:bg-background/95 border border-gray-700 dark:border-border text-white dark:text-foreground hover:bg-gray-700/95 dark:hover:bg-background",
          className
        )}
        aria-label="Open category filter"
        data-testid="category-filter-toggle"
      >
        {hasActiveFilter ? (
          <span className="text-lg">{GROUP_ICONS[value as TaxonomyGroupId]}</span>
        ) : (
          <Filter size={22} />
        )}
      </button>

      {isOpen && (
        <div 
          className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/50 backdrop-blur-sm"
          onClick={handleBackdropClick}
        >
          <div className="bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl min-w-[220px] max-w-[280px] overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700">
              <span className="text-sm font-medium text-white">Category Filter</span>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1 rounded-full hover:bg-gray-700 transition-colors"
                aria-label="Close"
              >
                <X size={18} className="text-gray-400" />
              </button>
            </div>

            {/* Options */}
            <div className="py-2">
              {/* All option */}
              <button
                onClick={() => handleSelect('all')}
                className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${
                  value === 'all'
                    ? 'bg-blue-600/20 text-blue-400'
                    : 'text-white hover:bg-gray-800'
                }`}
                data-testid="filter-all"
              >
                <span className="w-5 text-center opacity-70">○</span>
                <span className="flex-1 text-sm">All Categories</span>
                {value === 'all' && <Check size={18} className="text-blue-400" />}
              </button>
              
              {/* Category options */}
              {TAXONOMY_GROUP_ORDER.map((groupId) => {
                const group = TAXONOMY_GROUPS[groupId];
                const isActive = value === groupId;
                
                return (
                  <button
                    key={groupId}
                    onClick={() => handleSelect(groupId)}
                    className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${
                      isActive
                        ? 'bg-blue-600/20 text-blue-400'
                        : 'text-white hover:bg-gray-800'
                    }`}
                    data-testid={`filter-${groupId}`}
                  >
                    <span className="w-5 text-center">{GROUP_ICONS[groupId]}</span>
                    <span className="flex-1 text-sm">{group.label}</span>
                    {isActive && <Check size={18} className="text-blue-400" />}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
