import * as React from "react";
import { cn } from "@/lib/utils";

interface TopBarMapProps {
  children?: React.ReactNode;   // search, filters, layers
  className?: string;
}

export function TopBarMap({ children, className }: TopBarMapProps) {
  return (
    <div
      className={cn(
        "pointer-events-none fixed inset-x-0 top-0 z-40 px-3 md:px-4",
        className
      )}
    >
      <div className="mx-auto max-w-screen-md pt-3 flex gap-2 justify-between">
        <div className="pointer-events-auto flex-1">{children}</div>
      </div>
    </div>
  );
}