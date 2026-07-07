/**
 * TypeCarousel - Mobile incident type selector using Taxonomy v2
 * 
 * A horizontal scroll-snap carousel grouped by category with large tap targets.
 * Inspired by WhatsApp emoji picker style.
 * 
 * v1.1 Backlog: True circular infinite loop scroll
 */

import { useState, useRef, useEffect, useMemo } from "react";
import { 
  TAXONOMY_GROUPS, 
  TAXONOMY_GROUP_ORDER, 
  TYPES_BY_GROUP,
  getGroupBadgeClasses,
  type TaxonomyGroupId,
  type TaxonomyType,
  deriveSeverityFromGroup 
} from "./taxonomyV2";
import { cn } from "@/lib/utils";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { 
  Drawer, 
  DrawerContent, 
  DrawerHeader, 
  DrawerTitle, 
  DrawerDescription,
  DrawerClose 
} from "@/components/ui/drawer";

interface TypeCarouselProps {
  onSelect: (typeId: string, groupId: TaxonomyGroupId) => void;
  className?: string;
}

const GROUP_COLORS: Record<TaxonomyGroupId, { bg: string; border: string; text: string; icon: string }> = {
  services: { 
    bg: 'bg-amber-500', 
    border: 'border-amber-400', 
    text: 'text-amber-950',
    icon: '🟧'
  },
  nabor_note: { 
    bg: 'bg-cyan-500', 
    border: 'border-cyan-400', 
    text: 'text-cyan-950',
    icon: '🔵'
  },
  emergency: { 
    bg: 'bg-orange-600', 
    border: 'border-orange-500', 
    text: 'text-white',
    icon: '❌'
  },
  critical: { 
    bg: 'bg-red-600', 
    border: 'border-red-500', 
    text: 'text-white',
    icon: '🔴'
  },
};

function GroupButton({ 
  groupId, 
  isActive, 
  onClick 
}: { 
  groupId: TaxonomyGroupId; 
  isActive: boolean; 
  onClick: () => void 
}) {
  const group = TAXONOMY_GROUPS[groupId];
  const colors = GROUP_COLORS[groupId];
  
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex-shrink-0 px-4 py-3 rounded-2xl font-medium text-sm transition-all duration-200",
        "flex items-center gap-2 min-w-[120px] justify-center",
        "active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/50",
        isActive 
          ? `${colors.bg} ${colors.text} shadow-lg scale-105` 
          : "bg-white/10 text-white/80 hover:bg-white/20"
      )}
      aria-pressed={isActive}
      data-testid={`group-button-${groupId}`}
    >
      <span className="text-lg">{colors.icon}</span>
      <span>{group.label}</span>
    </button>
  );
}

function TypeButton({ 
  type, 
  onClick 
}: { 
  type: TaxonomyType; 
  onClick: () => void 
}) {
  const isCustom = type.isCustom;
  
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex flex-col items-center justify-center gap-2 p-4 rounded-2xl",
        "min-w-[100px] min-h-[100px]",
        "bg-white/5 hover:bg-white/10 active:scale-95",
        "transition-all duration-150",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-white/50",
        "border border-white/10"
      )}
      style={{ 
        boxShadow: `0 0 20px ${type.color}30`,
        borderColor: `${type.color}40`
      }}
      data-testid={`type-button-${type.id}`}
    >
      <div 
        className={cn(
          "w-12 h-12 rounded-full flex items-center justify-center text-xl font-bold",
          isCustom && "border-2 border-dashed"
        )}
        style={{ 
          backgroundColor: `${type.color}20`,
          borderColor: isCustom ? type.color : 'transparent'
        }}
      >
        {isCustom ? "+" : type.label.charAt(0)}
      </div>
      <span className="text-xs text-center text-white/90 font-medium leading-tight">
        {type.label}
      </span>
    </button>
  );
}

export default function TypeCarousel({ onSelect, className }: TypeCarouselProps) {
  const [activeGroup, setActiveGroup] = useState<TaxonomyGroupId>("services");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  
  const activeTypes = useMemo(() => TYPES_BY_GROUP[activeGroup], [activeGroup]);
  const group = TAXONOMY_GROUPS[activeGroup];
  const colors = GROUP_COLORS[activeGroup];
  
  const handleGroupChange = (groupId: TaxonomyGroupId) => {
    setActiveGroup(groupId);
    // Scroll group buttons to center the active one
    const container = scrollRef.current;
    if (container) {
      const button = container.querySelector(`[data-testid="group-button-${groupId}"]`) as HTMLElement;
      if (button) {
        button.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
      }
    }
  };
  
  const handleTypeSelect = (type: TaxonomyType) => {
    onSelect(type.id, activeGroup);
    setDrawerOpen(false);
  };
  
  const navigateGroup = (direction: 'prev' | 'next') => {
    const currentIndex = TAXONOMY_GROUP_ORDER.indexOf(activeGroup);
    let newIndex: number;
    
    if (direction === 'next') {
      newIndex = (currentIndex + 1) % TAXONOMY_GROUP_ORDER.length;
    } else {
      newIndex = (currentIndex - 1 + TAXONOMY_GROUP_ORDER.length) % TAXONOMY_GROUP_ORDER.length;
    }
    
    handleGroupChange(TAXONOMY_GROUP_ORDER[newIndex]);
  };

  return (
    <div className={cn("w-full", className)}>
      {/* Header */}
      <div className="text-center mb-6">
        <h1 className="text-xl font-bold text-white">Report Incident</h1>
        <p className="mt-1 text-sm text-white/60">
          Choose a category, then select the incident type
        </p>
      </div>
      
      {/* Group Carousel with Navigation Arrows */}
      <div className="relative mb-6">
        <button
          onClick={() => navigateGroup('prev')}
          className="absolute left-0 top-1/2 -translate-y-1/2 z-10 p-2 rounded-full bg-black/50 text-white/70 hover:text-white hover:bg-black/70 transition-colors"
          aria-label="Previous category"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        
        <div 
          ref={scrollRef}
          className="flex gap-3 overflow-x-auto px-10 py-2 scroll-smooth snap-x snap-mandatory hide-scrollbar"
          style={{ scrollSnapType: 'x mandatory' }}
        >
          {TAXONOMY_GROUP_ORDER.map((groupId) => (
            <div key={groupId} className="snap-center">
              <GroupButton
                groupId={groupId}
                isActive={activeGroup === groupId}
                onClick={() => handleGroupChange(groupId)}
              />
            </div>
          ))}
        </div>
        
        <button
          onClick={() => navigateGroup('next')}
          className="absolute right-0 top-1/2 -translate-y-1/2 z-10 p-2 rounded-full bg-black/50 text-white/70 hover:text-white hover:bg-black/70 transition-colors"
          aria-label="Next category"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>
      
      {/* Selected Group Description */}
      <div 
        className={cn(
          "mb-4 p-3 rounded-xl text-center",
          colors.bg, colors.text
        )}
      >
        <div className="font-semibold">{group.emoji} {group.label}</div>
        <div className="text-xs opacity-80">{group.description}</div>
      </div>
      
      {/* Type Grid */}
      <div className="grid grid-cols-3 gap-3 max-h-[50vh] overflow-y-auto p-1">
        {activeTypes.map((type) => (
          <TypeButton
            key={type.id}
            type={type}
            onClick={() => handleTypeSelect(type)}
          />
        ))}
      </div>
      
      {/* CSS for hiding scrollbar */}
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

/**
 * TypeCarouselSheet - Drawer wrapper for the carousel
 * Use this when you want the carousel in a bottom sheet
 */
export function TypeCarouselSheet({ 
  open, 
  onOpenChange, 
  onSelect 
}: { 
  open: boolean; 
  onOpenChange: (open: boolean) => void;
  onSelect: (typeId: string, groupId: TaxonomyGroupId) => void;
}) {
  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="glass-surface rounded-t-2xl z-[61] border border-white/10 max-h-[90svh]">
        <DrawerHeader className="flex items-center justify-between px-4">
          <div>
            <DrawerTitle className="text-base font-semibold">Choose Incident Type</DrawerTitle>
            <DrawerDescription className="text-xs opacity-80">
              Select a category and type to report
            </DrawerDescription>
          </div>
          <DrawerClose className="p-2 rounded-full hover:bg-white/10 active:scale-95">
            <X className="h-5 w-5" />
          </DrawerClose>
        </DrawerHeader>
        <div className="px-4 pb-8">
          <TypeCarousel 
            onSelect={(typeId, groupId) => {
              onSelect(typeId, groupId);
              onOpenChange(false);
            }} 
          />
        </div>
      </DrawerContent>
    </Drawer>
  );
}

/**
 * QuickGroupButtons - Compact group buttons for triggering the full carousel
 * Use this as entry point FABs on the report page
 */
export function QuickGroupButtons({ 
  onGroupSelect 
}: { 
  onGroupSelect: (groupId: TaxonomyGroupId) => void 
}) {
  return (
    <div className="flex flex-col gap-3 w-full max-w-md mx-auto">
      {TAXONOMY_GROUP_ORDER.map((groupId) => {
        const group = TAXONOMY_GROUPS[groupId];
        const colors = GROUP_COLORS[groupId];
        
        return (
          <button
            key={groupId}
            onClick={() => onGroupSelect(groupId)}
            className={cn(
              "w-full py-4 px-6 rounded-2xl font-semibold text-lg",
              "flex items-center justify-center gap-3",
              "active:scale-[0.98] transition-all duration-150",
              "focus:outline-none focus-visible:ring-2 focus-visible:ring-white/50",
              "shadow-lg",
              colors.bg, colors.text
            )}
            data-testid={`quick-group-${groupId}`}
          >
            <span className="text-2xl">{colors.icon}</span>
            <span>{group.label}</span>
          </button>
        );
      })}
    </div>
  );
}
