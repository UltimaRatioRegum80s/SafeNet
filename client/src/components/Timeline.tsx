import React from "react";

type Variant = "incident" | "message";
type Severity = "low" | "medium" | "high" | "critical";

export function Timeline({ children }: { children: React.ReactNode }) {
  return (
    <ol className="relative space-y-3 sm:space-y-4">
      {children}
    </ol>
  );
}

export function TimelineItem({
  children,
  variant = "incident",
  severity = "medium",
}: {
  children: React.ReactNode;
  variant?: Variant;
  severity?: Severity;
}) {
  return (
    <li className="relative">
      {children}
    </li>
  );
}

/**
 * Sticky date separator.
 * - `topClass`: matches your header height (e.g., "top-14", "top-16").
 * - Set `sticky` false to use the non-sticky chip.
 */
export function TimelineSeparator({
  label,
  sticky = true,
  topClass = "top-16",
}: {
  label: string;
  sticky?: boolean;
  /** Tailwind class for `top-*` offset under the fixed header */
  topClass?: string;
}) {
  return (
    <li className="relative">
      <div
        className={[
          "flex items-center",
          sticky ? `sticky z-20 ${topClass}` : "",
        ].join(" ")}
      >
        <span
          className="
            mx-auto select-none rounded-full border border-white/10
            bg-zinc-900/80 px-3 py-1 text-xs font-medium text-zinc-300
            shadow-sm backdrop-blur supports-[backdrop-filter]:backdrop-blur
            shadow-[0_1px_0_0_rgba(255,255,255,0.04)]
          "
          aria-label={`Date: ${label}`}
        >
          {label}
        </span>
      </div>
    </li>
  );
}
