/**
 * Reporting entry, redesigned.
 *
 * The app has two genuinely different things called "reporting", with
 * different data and different permissions: a community report that everyone
 * nearby can see, and a service request that goes to one verified
 * organisation. Today you reach them from different places and neither says
 * who will see it. This screen states the choice first, then keeps each path
 * as short as it already is.
 *
 * Deliberate details:
 * - "Submit" is replaced by the actual outcome: "Post community report" and
 *   "Send request to <organisation>".
 * - Location is shown and reviewable before anything is sent, and the sheet
 *   says plainly what is shared.
 * - When location is unavailable the screen gives the reason and a recovery
 *   action, instead of only disabling the button.
 * - Categories keep every supported type and their existing IDs; only the
 *   letter-circles become real icons with full labels.
 * - Urgent guidance is findable and states that NaborNet dispatches no one.
 */
import { useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  Building2,
  ChevronRight,
  LocateFixed,
  MapPin,
  Megaphone,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { TAXONOMY_GROUPS, type TaxonomyGroupId, type TaxonomyType } from "@/features/report/taxonomyV2";
import {
  GROUP_HEADINGS,
  GROUP_ORDER_FOR_REPORTING,
  TYPES_BY_GROUP,
  iconForType,
} from "./reportTaxonomy";

export type ReportIntent = "community" | "service";

export interface LocationState {
  status: "ready" | "unavailable";
  /** Present when status is "ready". */
  label?: string;
  coords?: { lat: number; lng: number };
  /** Present when status is "unavailable" — why, in plain words. */
  reason?: string;
}

export interface ReportEntrySliceProps {
  area: string;
  location: LocationState;
  /** Verified organisations that can receive a service request in this area. */
  organisations: { id: string; name: string }[];
  onAction?: (action: string) => void;
  initialIntent?: ReportIntent | null;
  initialType?: TaxonomyType | null;
}

export function ReportEntrySlice({
  area,
  location,
  organisations,
  onAction,
  initialIntent = null,
  initialType = null,
}: ReportEntrySliceProps) {
  const [intent, setIntent] = useState<ReportIntent | null>(initialIntent);
  const [selected, setSelected] = useState<TaxonomyType | null>(initialType);
  const go = (action: string) => onAction?.(action);

  if (intent === null) {
    return (
      <IntentChooser
        area={area}
        hasOrganisations={organisations.length > 0}
        onChoose={(next) => {
          setIntent(next);
          go(`intent:${next}`);
        }}
        onAction={onAction}
      />
    );
  }

  if (intent === "service") {
    return (
      <ServiceRequestForm
        area={area}
        organisations={organisations}
        onBack={() => setIntent(null)}
        onAction={onAction}
      />
    );
  }

  return (
    <CommunityReportFlow
      area={area}
      location={location}
      selected={selected}
      onSelect={setSelected}
      onBack={() => (selected ? setSelected(null) : setIntent(null))}
      onAction={onAction}
    />
  );
}

/* ------------------------------ Step 1: intent ---------------------------- */

function IntentChooser({
  area,
  hasOrganisations,
  onChoose,
  onAction,
}: {
  area: string;
  hasOrganisations: boolean;
  onChoose: (intent: ReportIntent) => void;
  onAction?: (action: string) => void;
}) {
  return (
    <div className="mx-auto w-full max-w-2xl px-4 pb-6 pt-4">
      <h1 className="text-xl font-semibold">What would you like to do?</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Both stay inside NaborNet. Neither one calls emergency services.
      </p>

      <div className="mt-5 space-y-3">
        <IntentCard
          icon={Megaphone}
          title="Share a community report"
          audience="Everyone in NaborNet within 5 km of the report"
          detail={`Appears on the map and in ${area}'s activity feed, with the location you confirm.`}
          onClick={() => onChoose("community")}
          testId="intent-community"
        />
        <IntentCard
          icon={Building2}
          title="Request a local service"
          audience={
            hasOrganisations
              ? "One verified organisation you choose, and you"
              : "No verified organisations here yet"
          }
          detail={
            hasOrganisations
              ? "Private. Other residents never see it. You can follow its progress."
              : `Requests to local organisations are not available in ${area} yet.`
          }
          disabled={!hasOrganisations}
          onClick={() => onChoose("service")}
          testId="intent-service"
        />
      </div>

      <div className="mt-6 rounded-xl border border-amber-500/40 bg-amber-500/10 p-4">
        <p className="flex items-start gap-2 text-sm text-amber-700 dark:text-amber-300">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>
            <strong className="font-semibold">
              If someone is in danger right now, call emergency services first.
            </strong>{" "}
            NaborNet does not dispatch anyone and does not pass reports to any
            outside system.
          </span>
        </p>
        <button
          type="button"
          onClick={() => onAction?.("emergency-guidance")}
          className="mt-2 min-h-[40px] text-sm font-semibold text-amber-700 underline dark:text-amber-300"
          data-testid="emergency-guidance"
        >
          What to do in an emergency
        </button>
      </div>
    </div>
  );
}

function IntentCard({
  icon: Icon,
  title,
  audience,
  detail,
  onClick,
  disabled,
  testId,
}: {
  icon: typeof Megaphone;
  title: string;
  audience: string;
  detail: string;
  onClick: () => void;
  disabled?: boolean;
  testId: string;
}) {
  return (
    <button
      type="button"
      onClick={disabled ? undefined : onClick}
      aria-disabled={disabled || undefined}
      data-testid={testId}
      className={cn(
        "flex w-full items-start gap-3 rounded-xl border border-border bg-card p-4 text-left",
        disabled && "opacity-60",
      )}
    >
      <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
        <Icon className="h-5 w-5" aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-base font-semibold">{title}</span>
        <span className="mt-1 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
          <Users className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          Who sees it: {audience}
        </span>
        <span className="mt-1.5 block text-sm text-muted-foreground">{detail}</span>
      </span>
      {!disabled && (
        <ChevronRight className="mt-1 h-5 w-5 shrink-0 text-muted-foreground" aria-hidden="true" />
      )}
    </button>
  );
}

/* --------------------- Step 2a: community report -------------------------- */

function CommunityReportFlow({
  area,
  location,
  selected,
  onSelect,
  onBack,
  onAction,
}: {
  area: string;
  location: LocationState;
  selected: TaxonomyType | null;
  onSelect: (type: TaxonomyType | null) => void;
  onBack: () => void;
  onAction?: (action: string) => void;
}) {
  return (
    <div className="mx-auto w-full max-w-2xl px-4 pb-6 pt-4">
      <BackRow onBack={onBack} label="Share a community report" />
      <p className="mt-1 text-sm text-muted-foreground">
        Seen by everyone in NaborNet within 5 km of {area}.
      </p>

      <div className="mt-5 space-y-6">
        {GROUP_ORDER_FOR_REPORTING.map((groupId) => (
          <CategoryGroup
            key={groupId}
            groupId={groupId}
            onSelect={onSelect}
            selectedId={selected?.id}
          />
        ))}
      </div>

      {selected && (
        <ReportSheet
          type={selected}
          location={location}
          onClose={() => onSelect(null)}
          onAction={onAction}
        />
      )}
    </div>
  );
}

function CategoryGroup({
  groupId,
  onSelect,
  selectedId,
}: {
  groupId: TaxonomyGroupId;
  onSelect: (type: TaxonomyType) => void;
  selectedId?: string;
}) {
  const heading = GROUP_HEADINGS[groupId];
  const group = TAXONOMY_GROUPS[groupId];

  return (
    <section aria-labelledby={`group-${groupId}`}>
      <h2 id={`group-${groupId}`} className="text-sm font-semibold">
        {heading.title}
      </h2>
      <p className="mt-0.5 text-xs text-muted-foreground">{heading.help}</p>
      <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4">
        {TYPES_BY_GROUP[groupId].map((type) => {
          const Icon = iconForType(type.id);
          const isSelected = type.id === selectedId;
          return (
            <button
              key={type.id}
              type="button"
              onClick={() => onSelect(type)}
              data-testid={`type-${type.id}`}
              aria-label={`${type.label} — ${group.label}`}
              className={cn(
                "flex min-h-[88px] flex-col items-center justify-center gap-2 rounded-xl border p-2 text-center",
                isSelected
                  ? "border-primary bg-primary/10"
                  : "border-border bg-card",
              )}
            >
              <span
                className="flex h-9 w-9 items-center justify-center rounded-full"
                style={{ backgroundColor: `${type.color}26`, color: type.color }}
              >
                <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
              </span>
              <span className="text-[12px] font-medium leading-tight">{type.label}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function ReportSheet({
  type,
  location,
  onClose,
  onAction,
}: {
  type: TaxonomyType;
  location: LocationState;
  onClose: () => void;
  onAction?: (action: string) => void;
}) {
  const ready = location.status === "ready";
  return (
    <div
      className="fixed inset-x-0 bottom-0 z-[60] rounded-t-2xl border-t border-border bg-background p-4 shadow-2xl"
      style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 16px)" }}
      role="dialog"
      aria-label={`${type.label} report`}
      data-testid="report-sheet"
    >
      <div className="mx-auto w-full max-w-2xl">
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-border" aria-hidden="true" />
        <h2 className="text-lg font-semibold">{type.label}</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Posted publicly to your neighbourhood. Add a note if it helps —
          it is optional.
        </p>

        <label className="mt-4 block text-sm font-medium" htmlFor="report-note">
          Note (optional)
        </label>
        <textarea
          id="report-note"
          rows={3}
          placeholder="What happened?"
          className="mt-1.5 w-full resize-none rounded-lg border border-border bg-card p-3 text-base"
        />

        {/* Location is reviewable before anything is transmitted. */}
        <div className="mt-4 rounded-lg border border-border bg-card p-3">
          <p className="flex items-start gap-2 text-sm">
            <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            <span className="min-w-0">
              {ready ? (
                <>
                  <span className="block font-medium">{location.label}</span>
                  <span className="block text-xs text-muted-foreground">
                    This exact point is shared with the report.
                  </span>
                </>
              ) : (
                <>
                  <span className="block font-medium">Location unavailable</span>
                  <span className="block text-xs text-muted-foreground">
                    {location.reason}
                  </span>
                </>
              )}
            </span>
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {ready ? (
              <button
                type="button"
                onClick={() => onAction?.("adjust-location")}
                className="min-h-[40px] rounded-lg border border-border px-3 text-sm font-semibold"
              >
                Move the pin
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => onAction?.("enable-location")}
                  className="flex min-h-[44px] items-center gap-1.5 rounded-lg border border-border px-3 text-sm font-semibold"
                  data-testid="report-enable-location"
                >
                  <LocateFixed className="h-4 w-4" aria-hidden="true" />
                  Turn on location
                </button>
                <button
                  type="button"
                  onClick={() => onAction?.("pick-on-map")}
                  className="min-h-[44px] rounded-lg border border-border px-3 text-sm font-semibold"
                  data-testid="report-pick-on-map"
                >
                  Choose the spot on the map
                </button>
              </>
            )}
          </div>
        </div>

        <div className="mt-4 flex items-center gap-3">
          <button
            type="button"
            onClick={onClose}
            className="min-h-[48px] rounded-lg px-3 text-sm font-semibold text-muted-foreground"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!ready}
            onClick={() => onAction?.("post-community-report")}
            className="ml-auto min-h-[48px] flex-1 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-50"
            data-testid="post-community-report"
          >
            Post community report
          </button>
        </div>
      </div>
    </div>
  );
}

/* --------------------- Step 2b: service request --------------------------- */

function ServiceRequestForm({
  area,
  organisations,
  onBack,
  onAction,
}: {
  area: string;
  organisations: { id: string; name: string }[];
  onBack: () => void;
  onAction?: (action: string) => void;
}) {
  const [organisationId, setOrganisationId] = useState(organisations[0]?.id ?? "");
  const chosen = organisations.find((o) => o.id === organisationId);

  return (
    <div className="mx-auto w-full max-w-2xl px-4 pb-6 pt-4">
      <BackRow onBack={onBack} label="Request a local service" />
      <p className="mt-1 text-sm text-muted-foreground">
        Private to you and the organisation you choose. Non-emergency matters
        only — this is not dispatched to anyone, and no response time is
        guaranteed.
      </p>

      <label className="mt-5 block text-sm font-medium" htmlFor="request-org">
        Send to
      </label>
      <select
        id="request-org"
        value={organisationId}
        onChange={(e) => setOrganisationId(e.target.value)}
        className="mt-1.5 min-h-[48px] w-full rounded-lg border border-border bg-card px-3 text-base"
      >
        {organisations.map((o) => (
          <option key={o.id} value={o.id}>
            {o.name}
          </option>
        ))}
      </select>
      <p className="mt-1.5 text-xs text-muted-foreground">
        Verified for {area}. Their duty officer sees requests inside NaborNet;
        no email or SMS is sent.
      </p>

      <label className="mt-4 block text-sm font-medium" htmlFor="request-title">
        What do you need?
      </label>
      <input
        id="request-title"
        placeholder="Short summary"
        className="mt-1.5 min-h-[48px] w-full rounded-lg border border-border bg-card px-3 text-base"
      />

      <label className="mt-4 block text-sm font-medium" htmlFor="request-detail">
        Details
      </label>
      <textarea
        id="request-detail"
        rows={4}
        placeholder="Where it is, when it started, anything useful"
        className="mt-1.5 w-full resize-none rounded-lg border border-border bg-card p-3 text-base"
      />

      <button
        type="button"
        onClick={() => onAction?.("send-service-request")}
        className="mt-5 min-h-[52px] w-full rounded-lg bg-primary px-4 text-base font-semibold text-primary-foreground"
        data-testid="send-service-request"
      >
        Send request to {chosen?.name ?? "the service"}
      </button>
      <p className="mt-2 text-center text-xs text-muted-foreground">
        You will see status changes under My requests, in the app.
      </p>
    </div>
  );
}

function BackRow({ onBack, label }: { onBack: () => void; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={onBack}
        aria-label="Back"
        className="-ml-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-muted-foreground"
      >
        <ArrowLeft className="h-5 w-5" aria-hidden="true" />
      </button>
      <h1 className="text-xl font-semibold">{label}</h1>
    </div>
  );
}

export default ReportEntrySlice;
