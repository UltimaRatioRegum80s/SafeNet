import { useLocation } from "wouter";
import { useState, useEffect } from "react";
import { Home, Camera, MapPin, MessageSquare, Building2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useIsDesktop } from "@/hooks/useBreakpoint";

// Pages that share filter state (radiusKm, sinceHours, group)
const FILTER_SHARING_PAGES = ["/community/map", "/community/feed"];
const PRESERVED_PARAMS = ["radiusKm", "sinceHours", "group"];

// Toggle items here (Stats omitted per @RDM for now)
const items = [
  { href: "/", label: "Home", icon: Home },
  { href: "/community/report", label: "Report", icon: Camera },
  { href: "/community/map", label: "Map", icon: MapPin },
  { href: "/community/feed", label: "Feed", icon: MessageSquare },
  { href: "/community/services", label: "Services", icon: Building2 },
  // { href: "/community/stats", label: "Stats", icon: BarChart3 }, // re-enable later
];

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

export default function GlobalNavLinks() {
  const [location, navigate] = useLocation();
  const isDesktop = useIsDesktop();
  // Track search params to re-render on popstate
  useLocationSearch();
  
  const handleClick = (e: React.MouseEvent, targetPath: string) => {
    e.preventDefault();
    // Compute href at click time to get current URL params
    const dynamicHref = buildHref(targetPath);
    navigate(dynamicHref);
  };
  
  // Desktop users don't post incidents — hide Report from nav
  const visibleItems = isDesktop
    ? items.filter(item => item.href !== "/community/report")
    : items;

  return (
    <nav className="flex items-center gap-4 text-sm">
      {visibleItems.map(({ href, label, icon: Icon }) => {
        const active = location === href;
        // Compute dynamic href at render time for middle-click/new-tab support
        const dynamicHref = buildHref(href);
        return (
          <a
            key={href}
            href={dynamicHref}
            onClick={(e) => handleClick(e, href)}
            className={cn(
              "inline-flex items-center gap-2 py-2 cursor-pointer",
              active ? "text-foreground font-semibold"
                     : "text-muted-foreground hover:text-foreground"
            )}
            aria-current={active ? "page" : undefined}
          >
            <Icon className="h-4 w-4" />
            <span>{label}</span>
          </a>
        );
      })}
    </nav>
  );
}