/**
 * Home, redesigned.
 *
 * Reading order in the first viewport: who and where, the primary action, one
 * honest sentence about nearby activity, then the next useful things to do.
 *
 * What it deliberately does not do:
 * - no zero-count ring, no zero-count donut, no "Your reports today: none",
 *   no "Community breakdown: none" — four ways of saying nothing happened
 * - never says the area is safe. The empty line is exactly
 *   "No reports in this area in the last 24 hours."
 * - never invents activity to fill space; personal requests and community
 *   notices appear only when there are some
 * - browsing does not depend on GPS. Without it, Home says which area it is
 *   showing and offers to turn location on.
 */
import {
  ArrowRight,
  Building2,
  ChevronRight,
  CircleUser,
  Clock,
  LocateFixed,
  Map,
  MapPin,
  Megaphone,
  Plus,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  relativeFromHours,
  relativeFromMinutes,
  STATE_LABELS,
  type ActivityItem,
  type NoticeItem,
  type RequestItem,
} from "./fixtures";

const GROUP_DOT: Record<ActivityItem["group"], string> = {
  services: "bg-amber-500",
  nabor_note: "bg-cyan-500",
  emergency: "bg-orange-600",
  critical: "bg-red-600",
};

export interface HomeSliceProps {
  area: string;
  /** false = location permission denied or unavailable; browsing still works. */
  hasPreciseLocation: boolean;
  /**
   * The radius the summary below was actually gathered at. The feed's radius
   * is the user's choice (1/3/5/10 km — ALLOWED_RADIUS_KM in
   * features/incidents/useFeedIncidents.ts), so this is stated, not assumed.
   */
  radiusKm: number;
  activity: ActivityItem[];
  requests: RequestItem[];
  notices: NoticeItem[];
  onAction?: (action: string) => void;
}

export function HomeSlice({
  area,
  hasPreciseLocation,
  radiusKm,
  activity,
  requests,
  notices,
  onAction,
}: HomeSliceProps) {
  const go = (action: string) => () => onAction?.(action);
  const count = activity.length;

  return (
    // One component, two shapes: a single column on phones, and on desktop the
    // same blocks in two columns so the personal and community material sits
    // beside the primary action instead of far below it.
    <div className="mx-auto w-full max-w-2xl px-4 pb-6 pt-3 lg:max-w-5xl lg:pt-6">
      {/* Brand + area + account. The area is a control, not a large card. */}
      <header className="mb-5 flex items-center justify-between gap-3">
        <div className="min-w-0">
          {/* Desktop already carries the wordmark in the top bar. */}
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-primary lg:hidden">
            NaborNet
          </p>
          <button
            type="button"
            onClick={go("change-area")}
            className="-ml-1 mt-0.5 flex min-h-[32px] items-center gap-1 rounded-lg px-1 text-left"
            data-testid="home-area"
          >
            <MapPin className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            <span className="truncate text-lg font-semibold">{area}</span>
            <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          </button>
        </div>
        <button
          type="button"
          onClick={go("account")}
          aria-label="Account and settings"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-border text-muted-foreground"
          data-testid="home-account"
        >
          <CircleUser className="h-5 w-5" aria-hidden="true" />
        </button>
      </header>

      <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start lg:gap-6">
        <div>
      {/* Primary action. Visible without scrolling at 360x640 and up. */}
      <button
        type="button"
        onClick={go("report")}
        className="mb-4 flex min-h-[56px] w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 text-base font-semibold text-primary-foreground shadow-sm"
        data-testid="home-report"
      >
        <Plus className="h-5 w-5" aria-hidden="true" />
        Report an issue
      </button>

      {/* One activity summary, with the time and area it covers. */}
      <section
        className="mb-4 rounded-xl border border-border bg-card p-4"
        aria-labelledby="home-activity-heading"
      >
        <div className="mb-1.5 flex items-center gap-1.5 text-xs text-muted-foreground">
          <Clock className="h-3.5 w-3.5" aria-hidden="true" />
          <span>Last 24 hours · within {radiusKm} km of {area}</span>
        </div>

        <h2 id="home-activity-heading" className="text-base font-semibold leading-snug">
          {count === 0
            ? "No reports in this area in the last 24 hours."
            : count === 1
              ? "1 report in this area in the last 24 hours."
              : `${count} reports in this area in the last 24 hours.`}
        </h2>

        {count > 0 && (
          <ul className="mt-3 divide-y divide-border" data-testid="home-activity-list">
            {activity.slice(0, 3).map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={go(`activity:${item.id}`)}
                  className="flex min-h-[48px] w-full items-center gap-3 py-2 text-left"
                >
                  <span
                    className={cn("h-2.5 w-2.5 shrink-0 rounded-full", GROUP_DOT[item.group])}
                    aria-hidden="true"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{item.title}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {item.where} · {relativeFromMinutes(item.agoMinutes)}
                    </span>
                  </span>
                  <ChevronRight
                    className="h-4 w-4 shrink-0 text-muted-foreground"
                    aria-hidden="true"
                  />
                </button>
              </li>
            ))}
          </ul>
        )}

        {count > 3 && (
          <button
            type="button"
            onClick={go("activity")}
            className="mt-2 flex min-h-[44px] items-center gap-1 text-sm font-semibold text-primary"
          >
            See all {count} <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </button>
        )}
      </section>

      {/* Next useful actions, immediately — not below four empty widgets. */}
      <div className="mb-4 grid grid-cols-2 gap-3">
        <SecondaryAction
          icon={Map}
          label="View map"
          onClick={go("map")}
          testId="home-view-map"
        />
        <SecondaryAction
          icon={Building2}
          label="Find local services"
          onClick={go("services")}
          testId="home-find-services"
        />
      </div>

      {/* Location state. Informational — it never blocks browsing. */}
      {!hasPreciseLocation && (
        <div
          className="mb-4 flex items-start gap-3 rounded-xl border border-border bg-muted/40 p-3 text-sm"
          data-testid="home-location-notice"
        >
          <LocateFixed className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          <div className="min-w-0">
            <p className="text-foreground">
              Showing {area}, the area saved on your profile. Location is turned off.
            </p>
            <button
              type="button"
              onClick={go("enable-location")}
              className="mt-1.5 min-h-[36px] text-sm font-semibold text-primary"
            >
              Turn on location
            </button>
          </div>
        </div>
      )}

        </div>

        <div>
      {/* Shown only when there is something to show. */}
      {requests.length > 0 && (
        <section className="mb-4" aria-labelledby="home-requests-heading">
          <div className="mb-2 flex items-center justify-between">
            <h2 id="home-requests-heading" className="text-sm font-semibold">
              Your service requests
            </h2>
            <button
              type="button"
              onClick={go("requests")}
              className="min-h-[36px] text-sm font-semibold text-primary"
            >
              View all
            </button>
          </div>
          <ul className="space-y-2">
            {requests.slice(0, 2).map((r) => (
              <li key={r.id}>
                <button
                  type="button"
                  onClick={go(`request:${r.id}`)}
                  className="w-full rounded-xl border border-border bg-card p-3 text-left"
                >
                  <p className="truncate text-sm font-medium">{r.title}</p>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">
                    {r.organisation}
                  </p>
                  <p className="mt-1.5 text-xs">
                    <span className="font-semibold text-foreground">
                      {STATE_LABELS[r.state]}
                    </span>
                    <span className="text-muted-foreground">
                      {" "}
                      · updated {relativeFromHours(r.updatedAgoHours)}
                    </span>
                  </p>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {notices.length > 0 && (
        <section className="mb-4" aria-labelledby="home-notices-heading">
          <h2
            id="home-notices-heading"
            className="mb-2 flex items-center gap-1.5 text-sm font-semibold"
          >
            <Megaphone className="h-4 w-4" aria-hidden="true" />
            From verified local services
          </h2>
          <ul className="space-y-2">
            {notices.slice(0, 2).map((n) => (
              <li key={n.id} className="rounded-xl border border-border bg-card p-3">
                <p className="text-xs text-muted-foreground">
                  {n.organisation} · {relativeFromHours(n.agoHours)}
                </p>
                <p className="mt-1 text-sm font-medium">{n.title}</p>
                <p className="mt-1 text-sm text-muted-foreground">{n.body}</p>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* The guardrail residents most need, stated once and always findable —
          rather than a repeated marketing block or filler dashboards. */}
      <section className="rounded-xl border border-border bg-muted/30 p-3">
        <p className="text-sm text-muted-foreground">
          NaborNet is a neighbourhood noticeboard. It is not an emergency
          service and does not send reports to police, fire or municipal
          systems.
        </p>
        <button
          type="button"
          onClick={go("emergency-guidance")}
          className="mt-1.5 min-h-[40px] text-sm font-semibold text-primary"
          data-testid="home-emergency-guidance"
        >
          What to do in an emergency
        </button>
      </section>
        </div>
      </div>
    </div>
  );
}

function SecondaryAction({
  icon: Icon,
  label,
  onClick,
  testId,
}: {
  icon: typeof Map;
  label: string;
  onClick: () => void;
  testId: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      data-testid={testId}
      className="flex min-h-[64px] flex-col items-start justify-center gap-1.5 rounded-xl border border-border bg-card px-3 py-3 text-left"
    >
      <Icon className="h-5 w-5 text-primary" aria-hidden="true" />
      <span className="text-sm font-semibold leading-tight">{label}</span>
    </button>
  );
}

export default HomeSlice;
