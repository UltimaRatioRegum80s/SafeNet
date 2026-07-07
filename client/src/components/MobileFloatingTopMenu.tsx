import React, { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Home, PlusCircle, MapPin, MessageSquare } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

// Routes configuration
const ROUTES = {
  home: "/",
  report: "/community/report",
  map: "/community/map",
  feed: "/community/feed",
} as const;

type Key = "home" | "report" | "map" | "feed";

// Pages that share filter state (radiusKm, sinceHours, group)
const FILTER_SHARING_PAGES = ["/community/map", "/community/feed"];
const PRESERVED_PARAMS = ["radiusKm", "sinceHours", "group"];

// Build href preserving filter params when navigating between feed/map
function buildHref(targetPath: string): string {
  if (typeof window === 'undefined') return targetPath;
  
  const currentPath = window.location.pathname;
  const currentParams = new URLSearchParams(window.location.search);
  
  // Only preserve params when navigating between filter-sharing pages
  const isFromFilterPage = FILTER_SHARING_PAGES.includes(currentPath);
  const isToFilterPage = FILTER_SHARING_PAGES.includes(targetPath);
  
  if (isFromFilterPage && isToFilterPage) {
    const preservedParams = new URLSearchParams();
    PRESERVED_PARAMS.forEach(key => {
      const value = currentParams.get(key);
      if (value) preservedParams.set(key, value);
    });
    const queryString = preservedParams.toString();
    return queryString ? `${targetPath}?${queryString}` : targetPath;
  }
  
  return targetPath;
}

// Minimal hook to force re-render on popstate (browser back/forward)
function useLocationSearch() {
  const [search, setSearch] = useState(() => 
    typeof window !== 'undefined' ? window.location.search : ''
  );
  
  useEffect(() => {
    const handlePopState = () => setSearch(window.location.search);
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);
  
  return search;
}

// Map URL path to active key
function keyFromPath(path: string): Key {
  if (path.startsWith("/community/map")) return "map";
  if (path.startsWith("/community/feed")) return "feed";
  if (path.startsWith("/community/report")) return "report";
  return "home";
}

export default function MobileFloatingTopMenu({ hiddenBySheet = false }: { hiddenBySheet?: boolean }) {
  const [location, navigate] = useLocation();
  // Track search params to re-render on popstate
  useLocationSearch();
  const active = keyFromPath(location);
  const { toast } = useToast();
  const [tappedKey, setTappedKey] = useState<Key | null>(null);

  const items: Array<{ key: Key; label: string; icon: React.ReactNode; to?: string }> = [
    { key: "home",   label: "Home",   icon: <Home className="w-5 h-5" />,          to: ROUTES.home },
    { key: "report", label: "Report", icon: <PlusCircle className="w-5 h-5" />,    to: ROUTES.report },
    { key: "map",    label: "Map",    icon: <MapPin className="w-5 h-5" />,        to: ROUTES.map },
    { key: "feed",   label: "Feed",   icon: <MessageSquare className="w-5 h-5" />, to: ROUTES.feed },
  ];

  const handleClick = (e: React.MouseEvent, to?: string, label?: string) => {
    e.preventDefault();
    
    // Trigger haptic feedback on supported devices
    if ('vibrate' in navigator) {
      navigator.vibrate(10);
    }
    
    if (to) {
      // Preserve filter params when navigating between Feed/Map
      const targetHref = buildHref(to);
      navigate(targetHref);
    } else {
      toast({
        title: "Coming soon",
        description: `${label ?? "This page"} isn't available yet.`,
      });
    }
  };

  const handleTapStart = (key: Key) => {
    // Show tap feedback
    setTappedKey(key);
    setTimeout(() => setTappedKey(null), 300);
  };

  return (
    <motion.div
      initial={{ y: -30, opacity: 0 }}
      animate={{ 
        y: hiddenBySheet ? -30 : 0, 
        opacity: hiddenBySheet ? 0 : 1 
      }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className={cn(
        "fixed z-[55] xl:hidden",
        "top-[calc(env(safe-area-inset-top)+12px)]",
        "left-0 right-0",
        "flex justify-center",
        hiddenBySheet && "pointer-events-none"
      )}
    >
      {/* Glass Dock Container */}
      <nav
        className={cn(
          // Height and padding
          "h-[58px] md:h-[62px] rounded-xl px-2.5 sm:px-3.5",
          // Layout
          "flex items-center gap-1.5 sm:gap-2",
          // Glass effect - light mode
          "bg-gradient-to-b from-white/60 to-white/40",
          "dark:from-neutral-800/70 dark:to-neutral-900/40",
          // Backdrop blur
          "backdrop-blur-md",
          "supports-[backdrop-filter]:bg-white/50",
          "supports-[backdrop-filter]:dark:bg-neutral-800/50",
          // Border
          "border border-white/20 dark:border-white/10",
          // Soft shadow - ambient glow
          "shadow-[0_8px_28px_-12px_rgba(0,0,0,0.45)]",
          "dark:shadow-[0_8px_28px_-12px_rgba(0,0,0,0.65)]"
        )}
        aria-label="Mobile navigation"
      >
        {items.map((it) => {
          const disabled = !it.to;
          const isActive = active === it.key;
          const isTapped = tappedKey === it.key;
          // Compute dynamic href at render time for middle-click/new-tab support
          const dynamicHref = it.to ? buildHref(it.to) : undefined;
          
          return (
            <motion.a
              key={it.key}
              href={dynamicHref}
              onClick={(e) => {
                handleTapStart(it.key);
                handleClick(e, it.to, it.label);
              }}
              aria-label={`Open ${it.label} page`}
              aria-current={isActive ? "page" : undefined}
              data-testid={`nav-${it.key}`}
              whileTap={{ scale: 0.9 }}
              className={cn(
                // Size and layout
                "relative grid place-items-center",
                "w-11 h-11 sm:w-12 sm:h-12 min-w-[44px] min-h-[44px]",
                "rounded-xl",
                // Transition
                "transition-colors duration-200",
                // Focus state
                "focus-visible:ring-2 focus-visible:ring-blue-400/70 focus-visible:outline-none",
                // Disabled state
                disabled && "text-foreground/30 dark:text-white/30 cursor-not-allowed pointer-events-none",
                // Active/Inactive colors
                !disabled && (isActive 
                  ? "text-blue-400" 
                  : "text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
                )
              )}
            >
              {/* Animated Active Indicator - slides between icons */}
              {isActive && (
                <motion.div
                  layoutId="activeIndicator"
                  className={cn(
                    "absolute inset-1 rounded-xl",
                    "bg-blue-500/15 dark:bg-blue-500/20",
                    "backdrop-blur-sm",
                    "border border-blue-400/20"
                  )}
                  transition={{
                    type: "spring",
                    stiffness: 380,
                    damping: 30
                  }}
                />
              )}
              
              {/* Tap Pulse Glow Effect */}
              <AnimatePresence>
                {isTapped && (
                  <motion.div
                    initial={{ scale: 0.8, opacity: 0.6 }}
                    animate={{ scale: 1.4, opacity: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.3, ease: "easeOut" }}
                    className="absolute inset-0 rounded-xl bg-blue-400/30 dark:bg-blue-400/20"
                  />
                )}
              </AnimatePresence>
              
              {/* Icon */}
              <span className="relative z-10">
                {it.icon}
              </span>
            </motion.a>
          );
        })}
      </nav>
    </motion.div>
  );
}
