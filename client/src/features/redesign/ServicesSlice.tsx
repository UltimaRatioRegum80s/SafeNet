/**
 * Services, redesigned — resident view and staff view.
 *
 * The live page opens with a marketing headline, a large location card, a long
 * safety block and four zero-count statistics before anything a resident can
 * act on. Here the first line is what the page is for, the first control is
 * Find a service, and the safety statement is one sentence with the fuller
 * guidance a tap away.
 *
 * Honest empty state: where no organisation is verified yet, the page says
 * "Requests to local organisations are not available here yet.", offers
 * community activity as the thing that does work, and puts "For service
 * providers" second — registering an organisation is not a resident's job.
 *
 * Staff view: the queue is the page. Unacknowledged work first, in progress
 * next, resolved behind a filter. Ages come from the request's own timestamps;
 * nothing here invents an SLA or a breach.
 */
import { useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  ArrowUpRight,
  Building2,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  Search,
  ShieldCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  relativeFromHours,
  STATE_LABELS,
  type OrganisationItem,
  type RequestItem,
} from "./fixtures";

type ResidentTab = "find" | "requests";

export interface ServicesSliceProps {
  area: string;
  organisations: OrganisationItem[];
  requests: RequestItem[];
  /** Shows the staff entry point. Eligibility is unchanged server-side. */
  isStaff?: boolean;
  onAction?: (action: string) => void;
}

export function ServicesSlice({
  area,
  organisations,
  requests,
  isStaff = false,
  onAction,
}: ServicesSliceProps) {
  const [tab, setTab] = useState<ResidentTab>("find");
  const [search, setSearch] = useState("");
  const go = (action: string) => onAction?.(action);

  const visible = organisations.filter((o) =>
    search.trim() ? `${o.name} ${o.blurb}`.toLowerCase().includes(search.trim().toLowerCase()) : true,
  );

  return (
    <div className="mx-auto w-full max-w-2xl px-4 pb-6 pt-4">
      <h1 className="text-xl font-semibold" data-testid="services-heading">
        Services in {area}
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Non-emergency requests to verified local organisations.{" "}
        <button
          type="button"
          onClick={() => go("safety-guidance")}
          className="font-semibold text-primary underline underline-offset-2"
        >
          In an emergency, call emergency services
        </button>
        .
      </p>

      {/* Two resident tabs, both fully labelled at 360px. */}
      <div
        role="tablist"
        aria-label="Services sections"
        className="mt-4 flex gap-1 rounded-xl bg-muted/50 p-1"
      >
        <TabButton
          id="find"
          label="Find a service"
          active={tab === "find"}
          onClick={() => setTab("find")}
        />
        <TabButton
          id="requests"
          label={`My requests${requests.length ? ` (${requests.length})` : ""}`}
          active={tab === "requests"}
          onClick={() => setTab("requests")}
        />
      </div>

      {tab === "find" && (
        <div className="mt-4">
          {organisations.length > 0 ? (
            <>
              <label className="sr-only" htmlFor="services-search">
                Search services
              </label>
              <div className="flex min-h-[48px] items-center gap-2 rounded-lg border border-border bg-card px-3">
                <Search className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                <input
                  id="services-search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by name or service"
                  className="min-h-[46px] w-full bg-transparent text-base outline-none"
                />
              </div>

              <ul className="mt-3 space-y-3">
                {visible.map((org) => (
                  <li key={org.id}>
                    <OrganisationCard org={org} onAction={onAction} />
                  </li>
                ))}
              </ul>
              {visible.length === 0 && (
                <p className="mt-6 text-sm text-muted-foreground">
                  Nothing matches “{search}”.
                </p>
              )}
            </>
          ) : (
            <NoServicesYet area={area} onAction={onAction} />
          )}
        </div>
      )}

      {tab === "requests" && (
        <div className="mt-4">
          {requests.length > 0 ? (
            <ul className="space-y-3">
              {requests.map((r) => (
                <li key={r.id}>
                  <RequestRow request={r} onAction={onAction} />
                </li>
              ))}
            </ul>
          ) : (
            <div className="rounded-xl border border-border bg-card p-4">
              <p className="text-sm font-medium">No requests yet</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {organisations.length
                  ? "Choose a verified organisation under Find a service to raise one. Its progress appears here."
                  : `Requests to local organisations are not available in ${area} yet.`}
              </p>
            </div>
          )}
        </div>
      )}

      {isStaff && (
        <button
          type="button"
          onClick={() => go("staff-workspace")}
          className="mt-6 flex min-h-[52px] w-full items-center justify-between rounded-xl border border-border bg-card px-4 text-left"
          data-testid="services-staff-entry"
        >
          <span>
            <span className="block text-sm font-semibold">Open your work queue</span>
            <span className="block text-xs text-muted-foreground">
              Requests waiting for your organisation
            </span>
          </span>
          <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden="true" />
        </button>
      )}
    </div>
  );
}

function TabButton({
  id,
  label,
  active,
  onClick,
}: {
  id: string;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      data-testid={`services-tab-${id}`}
      className={cn(
        "min-h-[44px] flex-1 rounded-lg px-3 text-sm font-semibold",
        active ? "bg-background text-foreground shadow-sm" : "text-muted-foreground",
      )}
    >
      {label}
    </button>
  );
}

function OrganisationCard({
  org,
  onAction,
}: {
  org: OrganisationItem;
  onAction?: (action: string) => void;
}) {
  return (
    <article className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Building2 className="h-5 w-5" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-xs text-muted-foreground">{org.kind}</p>
          <h3 className="text-base font-semibold leading-snug">{org.name}</h3>
          <p className="mt-1 text-sm text-muted-foreground">{org.blurb}</p>
        </div>
      </div>

      {/* What "Verified" means here, in words, not just a badge. */}
      <p className="mt-3 flex items-start gap-1.5 rounded-lg bg-muted/50 p-2.5 text-xs text-muted-foreground">
        <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" aria-hidden="true" />
        <span>
          <strong className="font-semibold text-foreground">Verified {org.verifiedOn}</strong> by a
          NaborNet administrator who does not run this organisation. {org.respondsVia}
        </span>
      </p>

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => onAction?.(`request:${org.id}`)}
          className="min-h-[44px] flex-1 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground"
        >
          Send a request
        </button>
        <button
          type="button"
          onClick={() => onAction?.(`subscribe:${org.id}`)}
          className="min-h-[44px] rounded-lg border border-border px-4 text-sm font-semibold"
        >
          Follow updates
        </button>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        Following shows their updates in the app. No email or push notifications
        are sent.
      </p>
    </article>
  );
}

function NoServicesYet({
  area,
  onAction,
}: {
  area: string;
  onAction?: (action: string) => void;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4" data-testid="services-empty">
      <h2 className="text-base font-semibold">
        Requests to local organisations are not available in {area} yet.
      </h2>
      <p className="mt-1.5 text-sm text-muted-foreground">
        No organisation here has been verified yet, so there is nowhere for a
        request to go. Everything else in NaborNet still works.
      </p>

      <button
        type="button"
        onClick={() => onAction?.("activity")}
        className="mt-4 flex min-h-[48px] w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground"
        data-testid="services-empty-activity"
      >
        Browse community activity
        <ArrowRight className="h-4 w-4" aria-hidden="true" />
      </button>

      <div className="mt-4 border-t border-border pt-3">
        <p className="text-xs text-muted-foreground">
          Do you run a municipality, police station, fire service or security
          service here?
        </p>
        <button
          type="button"
          onClick={() => onAction?.("register-organisation")}
          className="mt-1 flex min-h-[40px] items-center gap-1 text-sm font-semibold text-primary"
          data-testid="services-empty-provider"
        >
          For service providers <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}

function RequestRow({
  request,
  onAction,
}: {
  request: RequestItem;
  onAction?: (action: string) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onAction?.(`request:${request.id}`)}
      className="w-full rounded-xl border border-border bg-card p-4 text-left"
    >
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <ClipboardList className="h-4 w-4" aria-hidden="true" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold leading-snug">{request.title}</span>
          <span className="mt-0.5 block truncate text-xs text-muted-foreground">
            {request.organisation}
          </span>
          <span className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
            <StateChip state={request.state} />
            <span className="text-muted-foreground">
              updated {relativeFromHours(request.updatedAgoHours)}
            </span>
          </span>
          <span className="mt-1.5 block text-xs text-muted-foreground">
            {request.lastUpdate}
          </span>
        </span>
      </div>
    </button>
  );
}

function StateChip({ state }: { state: RequestItem["state"] }) {
  const tone =
    state === "new"
      ? "bg-amber-500/15 text-amber-700 dark:text-amber-300"
      : state === "resolved"
        ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
        : "bg-primary/15 text-primary";
  return (
    <span className={cn("rounded-full px-2 py-0.5 font-semibold", tone)}>
      {STATE_LABELS[state]}
    </span>
  );
}

/* ------------------------------ Staff view -------------------------------- */

export function StaffQueueSlice({
  organisation,
  queue,
  onAction,
}: {
  organisation: string;
  queue: RequestItem[];
  onAction?: (action: string) => void;
}) {
  const [showResolved, setShowResolved] = useState(false);

  const unacknowledged = queue.filter((r) => r.state === "new");
  const inProgress = queue.filter((r) => r.state === "acknowledged" || r.state === "in_progress");
  const resolved = queue.filter((r) => r.state === "resolved");

  return (
    <div className="mx-auto w-full max-w-2xl px-4 pb-6 pt-4">
      {/* No slogan, no resident introduction — the queue is the page. */}
      <p className="text-xs text-muted-foreground">{organisation}</p>
      <h1 className="text-xl font-semibold">Work queue</h1>

      <p className="mt-3 flex items-start gap-2 rounded-lg border border-border bg-card p-3 text-sm">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" aria-hidden="true" />
        <span>
          <strong className="font-semibold">
            {unacknowledged.length === 1
              ? "1 request has not been acknowledged"
              : `${unacknowledged.length} requests have not been acknowledged`}
          </strong>
          <span className="block text-muted-foreground">
            Oldest has been waiting{" "}
            {relativeFromHours(Math.max(0, ...unacknowledged.map((r) => r.ageHours))).replace(
              " ago",
              "",
            )}
            .
          </span>
        </span>
      </p>

      <StaffSection title="Not yet acknowledged" items={unacknowledged} onAction={onAction} />
      <StaffSection title="In progress" items={inProgress} onAction={onAction} />

      <div className="mt-6 border-t border-border pt-3">
        <button
          type="button"
          onClick={() => setShowResolved((v) => !v)}
          className="min-h-[44px] text-sm font-semibold text-primary"
          data-testid="staff-toggle-resolved"
        >
          {showResolved ? "Hide" : "Show"} resolved ({resolved.length})
        </button>
        {showResolved && (
          <ul className="mt-2 space-y-3">
            {resolved.map((r) => (
              <li key={r.id}>
                <StaffRow request={r} onAction={onAction} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function StaffSection({
  title,
  items,
  onAction,
}: {
  title: string;
  items: RequestItem[];
  onAction?: (action: string) => void;
}) {
  if (items.length === 0) return null;
  return (
    <section className="mt-5">
      <h2 className="mb-2 text-sm font-semibold">
        {title} <span className="text-muted-foreground">({items.length})</span>
      </h2>
      <ul className="space-y-3">
        {items.map((r) => (
          <li key={r.id}>
            <StaffRow request={r} onAction={onAction} />
          </li>
        ))}
      </ul>
    </section>
  );
}

function StaffRow({
  request,
  onAction,
}: {
  request: RequestItem;
  onAction?: (action: string) => void;
}) {
  // The next permitted action only; state transitions stay server-owned.
  const nextAction =
    request.state === "new"
      ? "Acknowledge"
      : request.state === "acknowledged"
        ? "Start work"
        : request.state === "in_progress"
          ? "Mark resolved"
          : null;

  return (
    <article className="rounded-xl border border-border bg-card p-4">
      <p className="text-sm font-semibold leading-snug">{request.title}</p>
      <p className="mt-1 text-xs text-muted-foreground">{request.organisation}</p>
      <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
        <StateChip state={request.state} />
        <span className="text-muted-foreground">
          raised {relativeFromHours(request.ageHours)}
        </span>
      </p>
      {nextAction && (
        <button
          type="button"
          onClick={() => onAction?.(`staff:${nextAction}:${request.id}`)}
          className="mt-3 flex min-h-[44px] items-center gap-1.5 rounded-lg border border-border px-3 text-sm font-semibold"
        >
          <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
          {nextAction}
        </button>
      )}
    </article>
  );
}

export default ServicesSlice;
