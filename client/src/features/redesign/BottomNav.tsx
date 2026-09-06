/**
 * Labelled bottom navigation for phones.
 *
 * Replaces the icon-only floating dock at the top of the screen. Every
 * destination carries a visible label, Report is the obvious primary action,
 * and the bar reserves safe-area space so it never sits over content or the
 * on-screen keyboard.
 *
 * Routes are unchanged. Feed keeps its /community/feed URL; only the label a
 * resident reads becomes "Activity".
 */
import { Building2, Home, Map, MessageSquare, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

export type NavKey = "home" | "map" | "report" | "activity" | "services";

const ITEMS: { key: NavKey; label: string; href: string; icon: typeof Home }[] = [
  { key: "home", label: "Home", href: "/", icon: Home },
  { key: "map", label: "Map", href: "/community/map", icon: Map },
  { key: "report", label: "Report", href: "/community/report", icon: Plus },
  { key: "activity", label: "Activity", href: "/community/feed", icon: MessageSquare },
  { key: "services", label: "Services", href: "/community/services", icon: Building2 },
];

export function BottomNav({
  active,
  onNavigate,
}: {
  active: NavKey;
  onNavigate?: (key: NavKey, href: string) => void;
}) {
  return (
    <nav
      aria-label="Main"
      // Phones and tablets only. Desktop keeps the existing labelled top bar,
      // which is already reachable there and leaves the viewport bottom free.
      className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-background/95 backdrop-blur xl:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
      data-testid="bottom-nav"
    >
      <ul className="mx-auto flex max-w-screen-sm items-stretch justify-between px-1">
        {ITEMS.map(({ key, label, href, icon: Icon }) => {
          const isActive = key === active;
          const isPrimary = key === "report";
          return (
            <li key={key} className="flex-1">
              <a
                href={href}
                aria-current={isActive ? "page" : undefined}
                onClick={(e) => {
                  if (!onNavigate) return;
                  e.preventDefault();
                  onNavigate(key, href);
                }}
                className={cn(
                  "flex min-h-[60px] flex-col items-center justify-center gap-1.5 px-1 py-2",
                  "text-[11px] font-medium leading-none",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                  isActive ? "text-primary" : "text-muted-foreground",
                )}
              >
                {/* Same slot height for every item so the labels sit on one
                    baseline; only the primary fills its slot with colour. */}
                <span
                  className={cn(
                    "flex h-7 items-center justify-center rounded-full transition-colors",
                    isPrimary ? "w-12 bg-primary text-primary-foreground" : "w-7",
                  )}
                >
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </span>
                <span className={cn(isPrimary && "text-foreground")}>{label}</span>
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** Space a scrolling page must leave so the bar never covers its last row. */
export const BOTTOM_NAV_SPACER = "calc(env(safe-area-inset-bottom, 0px) + 72px)";

export default BottomNav;
