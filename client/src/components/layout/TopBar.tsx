import * as React from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Share2, Search, Bell, Home } from "lucide-react";
import GlobalNavLinks from "./GlobalNavLinks";

type Action = { 
  key: string; 
  aria: string; 
  onClick?: () => void; 
  icon?: React.ReactNode;
  render?: () => React.ReactNode;  // NEW: lets you inject ThemeToggle, etc.
};

export interface TopBarProps {
  title: string;
  actions?: Action[];               // optional; defaults provided
  className?: string;
}

export function TopBar({ title, actions, className }: TopBarProps) {
  const defaultActions: Action[] = [
    { key: "share", aria: "Share", icon: <Share2 className="h-5 w-5" /> },
    { key: "search", aria: "Search", icon: <Search className="h-5 w-5" /> },
    { key: "bell", aria: "Notifications", icon: <Bell className="h-5 w-5" /> },
  ];

  const items = actions ?? defaultActions;

  return (
    <header
      role="banner"
      className={cn(
        "sticky top-0 z-40 border-b bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60",
        className
      )}
    >
      {/* Row 1: icon + title (left), compact actions (right) */}
      <div className="mx-auto w-full max-w-screen-md h-14 px-3 md:px-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <a href="/" aria-label="Home">
            <Home className="h-5 w-5" />
          </a>
          <div className="text-lg font-semibold tracking-[-0.01em]">{title}</div>
        </div>
        <div className="flex items-center gap-1.5">
          {items.map((a) =>
            a.render ? (
              <div key={a.key}>{a.render()}</div>
            ) : (
              <Button
                key={a.key}
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                aria-label={a.aria}
                onClick={a.onClick}
              >
                {a.icon}
              </Button>
            )
          )}
        </div>
      </div>

      {/* Row 2: Global nav links with icons + labels */}
      <div className="border-t">
        <div className="mx-auto w-full max-w-screen-md px-3 md:px-4">
          <GlobalNavLinks />
        </div>
      </div>
    </header>
  );
}