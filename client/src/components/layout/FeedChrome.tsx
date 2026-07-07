import React from "react";
import { useLocation } from "wouter";
import { Home, PlusCircle, MapPin, MessageSquare, Share2, Search, Bell } from "lucide-react";
import { cn } from "@/lib/utils";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useLocationStore } from "@/store/locationStore";
import { pickQueryLocation } from "@/lib/useDeviceLocation";

// Hook to detect mobile/tablet breakpoints
function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState(() => 
    typeof window !== "undefined" && window.innerWidth < 1024
  );
  
  React.useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 1024);
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);
  
  return isMobile;
}

// Hook to measure element height
function useMeasuredHeight(ref: React.RefObject<HTMLElement>) {
  const [height, setHeight] = React.useState(0);
  
  React.useLayoutEffect(() => {
    const measure = () => {
      if (ref.current) {
        setHeight(ref.current.offsetHeight);
      }
    };
    
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [ref]);
  
  return height;
}

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
  const [search, setSearch] = React.useState(() => 
    typeof window !== 'undefined' ? window.location.search : ''
  );
  
  React.useEffect(() => {
    const handlePopState = () => setSearch(window.location.search);
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);
  
  return search;
}

// Primary Navigation Component (Home/Report/Map/Feed)
function PrimaryNav() {
  const [location, navigate] = useLocation();
  const isMobile = useIsMobile();
  // Track search params to re-render on popstate
  useLocationSearch();

  // GPS for report gating — desktop users never report
  const currentLocation = useLocationStore(state => state.currentLocation);
  const lastGoodLocation = useLocationStore(state => state.lastGoodLocation);
  const hasGps = !!pickQueryLocation({ currentLocation, lastGoodLocation });

  const allItems = [
    { href: "/", label: "Home", icon: Home, requiresGps: false },
    { href: "/community/report", label: "Report", icon: PlusCircle, requiresGps: true },
    { href: "/community/map", label: "Map", icon: MapPin, requiresGps: false },
    { href: "/community/feed", label: "Feed", icon: MessageSquare, requiresGps: false },
  ];

  // Desktop: hide Report entirely. Mobile: show all (Report disabled when no GPS)
  const items = isMobile ? allItems : allItems.filter(i => i.href !== "/community/report");
  
  const handleClick = (e: React.MouseEvent, targetPath: string, requiresGps: boolean) => {
    e.preventDefault();
    if (requiresGps && !hasGps) return; // silent — button is visually disabled
    const dynamicHref = buildHref(targetPath);
    navigate(dynamicHref);
  };
  
  return (
    <nav className="flex items-center justify-center gap-6 px-4 py-3 bg-slate-900/95 backdrop-blur border-b border-white/10">
      {items.map(({ href, label, icon: Icon, requiresGps }) => {
        const active = location === href;
        const isDisabled = requiresGps && !hasGps;
        // Compute dynamic href at render time for middle-click/new-tab support
        const dynamicHref = buildHref(href);
        return (
          <a
            key={href}
            href={isDisabled ? undefined : dynamicHref}
            title={isDisabled ? "Enable GPS to report" : undefined}
            aria-disabled={isDisabled || undefined}
            onClick={(e) => handleClick(e, href, requiresGps)}
            className={cn(
              "flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
              isDisabled ? "opacity-40 cursor-not-allowed" : "cursor-pointer",
              active 
                ? "bg-[#4cc0ff] text-white" 
                : "text-zinc-300 hover:text-white hover:bg-zinc-800"
            )}
          >
            <Icon className="h-4 w-4" />
            <span className="hidden sm:inline">{label}</span>
          </a>
        );
      })}
    </nav>
  );
}

// Top Header Component (matching Dashboard/Report pages)
function TopHeader() {
  return (
    <header className="border-b bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto w-full max-w-screen-md h-14 px-3 md:px-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Link href="/">
            <Home className="h-5 w-5 text-foreground" />
          </Link>
          <div className="text-lg font-semibold tracking-[-0.01em] text-foreground">Feed</div>
        </div>
        <div className="flex items-center gap-1.5">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            aria-label="Share"
          >
            <Share2 className="h-5 w-5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            aria-label="Search"
          >
            <Search className="h-5 w-5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            aria-label="Notifications"
          >
            <Bell className="h-5 w-5" />
          </Button>
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}

// Feed Chrome Layout Component
interface FeedChromeProps {
  children: React.ReactNode;
  segmentTabs: React.ReactNode;
  swapOnMobile?: boolean;
}

export function FeedChrome({ children, segmentTabs, swapOnMobile = true }: FeedChromeProps) {
  const isMobile = useIsMobile();
  const headerRef = React.useRef<HTMLDivElement>(null);
  const topRef = React.useRef<HTMLDivElement>(null);
  const bottomRef = React.useRef<HTMLDivElement>(null);
  
  const headerHeight = useMeasuredHeight(headerRef);
  const topHeight = useMeasuredHeight(topRef);
  const bottomHeight = useMeasuredHeight(bottomRef);
  
  // Determine which component goes where based on mobile state
  const shouldSwap = isMobile && swapOnMobile;
  const TopSlot = shouldSwap ? <PrimaryNav /> : segmentTabs;
  const BottomSlot = shouldSwap ? segmentTabs : <PrimaryNav />;
  
  return (
    <div className="min-h-screen bg-black text-white flex flex-col">
      {/* TOP HEADER - Fixed (like Dashboard/Report pages) */}
      <div 
        ref={headerRef} 
        className="fixed inset-x-0 top-0 z-50"
        style={{ paddingTop: 'env(safe-area-inset-top)' }}
      >
        <TopHeader />
      </div>
      
      {/* PRIMARY/SEGMENT NAV BAR 1 - Fixed */}
      <div 
        ref={topRef} 
        className="fixed inset-x-0 z-40"
        style={{ top: headerHeight }}
      >
        {TopSlot}
      </div>
      
      {/* PRIMARY/SEGMENT NAV BAR 2 - Fixed */}
      <div 
        ref={bottomRef} 
        className="fixed inset-x-0 z-30"
        style={{ top: headerHeight + topHeight }}
      >
        {BottomSlot}
      </div>
      
      {/* MAIN CONTENT - with dynamic padding */}
      <main 
        className="flex-1"
        style={{ 
          paddingTop: headerHeight + topHeight + bottomHeight,
          minHeight: '100vh'
        }}
      >
        {children}
      </main>
    </div>
  );
}

export default FeedChrome;