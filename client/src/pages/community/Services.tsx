/**
 * Community Services — residents and verified local services, in one place.
 *
 * What this page is NOT: it is not emergency dispatch, and it is not
 * integrated with any municipal, police, fire or security system. Requests
 * raised here are tracked inside NaborNet and carry no response guarantee.
 * The page says so plainly, above the fold, and again on the request form.
 *
 * Renders inside AppLayout, so it provides no header, navigation or footer
 * of its own. Styling lives in @/styles/services.css and is driven by the
 * app's theme tokens.
 */
import { useCallback, useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";
import { Link } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowUpRight,
  Bell,
  Building2,
  CheckCircle2,
  ClipboardList,
  Flame,
  Loader2,
  MapPin,
  Plus,
  Search,
  ShieldCheck,
  Users,
  X,
} from "lucide-react";
import { useAuthStore } from "@/store/auth";
import {
  REQUEST_CATEGORIES,
  SERVICE_LABELS,
  SERVICE_TYPES,
  nextStates,
  type CommunityOverview,
  type DirectoryOrganisation,
  type ManagedOrganisation,
  type OrganisationApplication,
  type RequestUpdate,
  type ServiceRequest,
  type ServiceType,
  type StaffMember,
} from "@shared/communityHub";
import "@/styles/services.css";

const API_ROOT = "/api/community-services";
const REQUEST_TIMEOUT_MS = 20_000;

async function api<T>(path: string, method = "GET", body?: unknown): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(`${API_ROOT}${path}`, {
      method,
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
    });
    // A proxy or an HTML error page will not parse as JSON; surface that as a
    // readable message rather than a raw SyntaxError.
    const text = await response.text();
    let data: any = {};
    if (text) {
      try {
        data = JSON.parse(text);
      } catch {
        throw new Error("Community Services returned an unexpected response.");
      }
    }
    if (!response.ok) throw new Error(data.error || "Unable to complete the request.");
    return data as T;
  } catch (error) {
    if ((error as Error).name === "AbortError") {
      throw new Error("The connection timed out. Please try again.");
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

const pretty = (text: string) => text.replaceAll("_", " ").replace(/^./, (s) => s.toUpperCase());

const formatDate = (value: string) => {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? "—"
    : parsed.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
};

const SERVICE_ICONS: Record<ServiceType, typeof Building2> = {
  municipality: Building2,
  police: ShieldCheck,
  fire: Flame,
  security: Users,
};

type ModalKind = "organisation" | "request" | "notice";

const MODAL_TITLES: Record<ModalKind, string> = {
  organisation: "Register your organisation",
  request: "New service request",
  notice: "Publish a community update",
};

const TABS = [
  { id: "overview", label: "Overview" },
  { id: "directory", label: "Find a service" },
  { id: "requests", label: "My requests" },
  { id: "workspace", label: "Service workspace" },
] as const;

type TabId = (typeof TABS)[number]["id"] | "verification";

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="hub-field">
      <span>{label}</span>
      {children}
    </label>
  );
}

function Empty({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="hub-empty">
      <ClipboardList size={30} aria-hidden="true" />
      <h3>{title}</h3>
      <p>{children}</p>
    </div>
  );
}

const FOCUSABLE =
  'button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href], [tabindex]:not([tabindex="-1"])';

/**
 * Accessible dialog: focus moves in on open, Tab cycles within, Escape and the
 * backdrop close it, and focus returns to whatever opened it.
 */
function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  const panel = useRef<HTMLElement>(null);
  const headingId = useId();
  const opener = useRef<HTMLElement | null>(null);

  useEffect(() => {
    opener.current = document.activeElement as HTMLElement | null;
    const first = panel.current?.querySelector<HTMLElement>(FOCUSABLE);
    first?.focus();

    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = overflow;
      // Return focus to the control that opened the dialog, if it still exists.
      if (opener.current?.isConnected) opener.current.focus();
    };
  }, []);

  const onKeyDown = (event: React.KeyboardEvent<HTMLElement>) => {
    if (event.key === "Escape") {
      event.stopPropagation();
      onClose();
      return;
    }
    if (event.key !== "Tab" || !panel.current) return;

    const items = Array.from(panel.current.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
      (el) => el.offsetParent !== null,
    );
    if (items.length === 0) return;

    const first = items[0];
    const last = items[items.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  return (
    <div className="hub-overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <section
        ref={panel}
        className="hub-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={headingId}
        onKeyDown={onKeyDown}
      >
        <header>
          <h2 id={headingId}>{title}</h2>
          <button type="button" className="hub-icon-button" aria-label="Close dialog" onClick={onClose}>
            <X size={20} aria-hidden="true" />
          </button>
        </header>
        {children}
      </section>
    </div>
  );
}

export default function Services() {
  const { user } = useAuthStore();
  const cache = useQueryClient();

  const [tab, setTab] = useState<TabId>("overview");
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [modal, setModal] = useState<ModalKind | null>(null);
  const [selectedOrg, setSelectedOrg] = useState("");
  const [selectedRequest, setSelectedRequest] = useState<ServiceRequest | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  // One idempotency key per request-form session; regenerated whenever the
  // form is opened and after a successful submit, so a retry of the *same*
  // submission is deduplicated but a genuinely new request is not.
  const [requestKey, setRequestKey] = useState(() => crypto.randomUUID());

  const overview = useQuery<CommunityOverview>({
    queryKey: ["community-services", user?.id],
    queryFn: () => api<CommunityOverview>("/overview"),
    refetchInterval: 30_000,
  });

  const data = overview.data;

  const review = useQuery<OrganisationApplication[]>({
    queryKey: ["service-verification", user?.id],
    queryFn: () => api<OrganisationApplication[]>("/verification"),
    enabled: !!data?.isAdmin && tab === "verification",
  });

  const updates = useQuery<RequestUpdate[]>({
    queryKey: ["service-updates", selectedRequest?.id, user?.id],
    queryFn: () => api<RequestUpdate[]>(`/requests/${selectedRequest!.id}/updates`),
    enabled: !!selectedRequest,
  });

  const directory = useMemo(() => data?.organisations ?? [], [data]);
  const managed = useMemo(() => data?.managed ?? [], [data]);
  const verifiedManaged = useMemo(() => managed.filter((o) => o.status === "verified"), [managed]);
  const unverifiedManaged = useMemo(() => managed.filter((o) => o.status !== "verified"), [managed]);

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    return directory.filter(
      (o) =>
        (!typeFilter || o.type === typeFilter) &&
        (!term || `${o.name} ${o.description}`.toLowerCase().includes(term)),
    );
  }, [directory, typeFilter, search]);

  const refresh = useCallback(async () => {
    await Promise.all([
      cache.invalidateQueries({ queryKey: ["community-services"] }),
      cache.invalidateQueries({ queryKey: ["service-verification"] }),
      cache.invalidateQueries({ queryKey: ["service-updates"] }),
    ]);
  }, [cache]);

  /** Run a mutation with shared busy/error/success handling. */
  const act = useCallback(
    async (fn: () => Promise<unknown>, message: string, close = true) => {
      setBusy(true);
      setError("");
      setSuccess("");
      try {
        await fn();
        await refresh();
        setSuccess(message);
        if (close) {
          setModal(null);
          setSelectedRequest(null);
        }
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setBusy(false);
      }
    },
    [refresh],
  );

  const openModal = (kind: ModalKind, organisationId = "") => {
    setError("");
    setSuccess("");
    setSelectedOrg(organisationId);
    setRequestKey(crypto.randomUUID());
    setModal(kind);
  };

  const readForm = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    return Object.fromEntries(new FormData(event.currentTarget).entries()) as Record<string, string>;
  };

  const emailVerified = data?.emailVerified === true;

  /* ------------------------------ Fragments ----------------------------- */

  const organisationCard = (org: DirectoryOrganisation) => {
    const Icon = SERVICE_ICONS[org.type] ?? Building2;
    return (
      <article className="hub-service" key={org.id}>
        <div className={`hub-service-icon ${org.type}`}>
          <Icon size={22} aria-hidden="true" />
        </div>
        <span className="hub-verified">
          <CheckCircle2 size={13} aria-hidden="true" /> Verified
        </span>
        <p className="hub-eyebrow">{SERVICE_LABELS[org.type]}</p>
        <h3>{org.name}</h3>
        <p className="hub-description">{org.description}</p>
        <p className="hub-location">
          <MapPin size={14} aria-hidden="true" />
          {org.city}, {org.country}
        </p>
        <div className="hub-contact">
          <a href={`tel:${org.phone.replace(/[^+\d]/g, "")}`}>{org.phone}</a>
          <a href={`mailto:${org.contact_email}`}>Email service</a>
          {/^https?:\/\//i.test(org.website) && (
            <a href={org.website} target="_blank" rel="noopener noreferrer">
              Website <ArrowUpRight size={12} aria-hidden="true" />
            </a>
          )}
        </div>
        <footer>
          <button
            type="button"
            className="hub-primary"
            onClick={() => openModal("request", org.id)}
            disabled={!emailVerified}
          >
            Make a request
          </button>
          <button
            type="button"
            className="hub-secondary"
            disabled={busy || !emailVerified}
            onClick={() =>
              act(
                () => api(`/organisations/${org.id}/follow`, org.following ? "DELETE" : "POST"),
                org.following ? "Subscription removed." : "Service added to your subscriptions.",
                false,
              )
            }
          >
            {org.following ? "Subscribed ✓" : "Subscribe"}
          </button>
        </footer>
      </article>
    );
  };

  const requestList = (requests: ServiceRequest[]) =>
    requests.length ? (
      <div className="hub-request-list">
        {requests.map((r) => (
          <button
            type="button"
            className="hub-request"
            key={r.id}
            onClick={() => {
              setError("");
              setSelectedRequest(r);
            }}
          >
            <span className="hub-request-icon">
              <ClipboardList size={18} aria-hidden="true" />
            </span>
            <span className="hub-request-main">
              <strong>{r.title}</strong>
              <small>
                {r.organisation_name} · {r.neighbourhood}
                {r.can_manage && !r.is_mine ? " · incoming" : ""}
              </small>
            </span>
            <span className="hub-request-meta">
              <span className={`hub-status ${r.state}`}>{pretty(r.state)}</span>
              <small className="hub-request-date">{formatDate(r.updated_at)}</small>
            </span>
          </button>
        ))}
      </div>
    ) : (
      <Empty title="No service requests yet">
        Choose a verified organisation to submit a non-emergency request. Its progress will appear
        here.
      </Empty>
    );

  const tabs: { id: TabId; label: string }[] = [
    ...TABS.map((t) => ({ id: t.id as TabId, label: t.label })),
    ...(data?.isAdmin ? [{ id: "verification" as TabId, label: "Verification" }] : []),
  ];

  /* -------------------------------- Render ------------------------------ */

  return (
    <div className="hub" data-testid="community-services">
      <div className="hub-heading">
        <div>
          <p className="hub-eyebrow">Your neighbourhood, connected</p>
          <h1>
            Better together.
            <br />
            <span>Safer, every day.</span>
          </h1>
          <p className="hub-muted">Connect with local services. Raise an issue. Follow it through.</p>
        </div>
        <div className="hub-community">
          <MapPin size={20} aria-hidden="true" />
          <div>
            <small>Your community</small>
            <strong>{data?.community.city || user?.city || "Your city"}</strong>
            <span>{data?.community.country || user?.country}</span>
          </div>
        </div>
      </div>

      <div className="hub-emergency">
        <ShieldCheck size={18} aria-hidden="true" />
        <p>
          <strong>For immediate danger, contact emergency services directly.</strong> NaborNet
          requests are not emergency dispatch, are not sent to any external system, and carry no
          guaranteed response.
        </p>
        <Link href="/safety" className="hub-link">
          Safety guidance <ArrowUpRight size={15} aria-hidden="true" />
        </Link>
      </div>

      <nav className="hub-tabs">
        <div role="tablist" aria-label="Community Services sections">
          {tabs.map(({ id, label }) => (
            <button
              key={id}
              type="button"
              role="tab"
              id={`hub-tab-${id}`}
              aria-selected={tab === id}
              aria-controls="hub-panel"
              onClick={() => {
                setTab(id);
                setError("");
              }}
            >
              {label}
            </button>
          ))}
        </div>
        <button
          type="button"
          className="hub-secondary"
          onClick={() => openModal("organisation")}
          disabled={!emailVerified}
        >
          <Plus size={15} aria-hidden="true" /> Register a service
        </button>
      </nav>

      {success && (
        <p className="hub-success" role="status">
          {success}
        </p>
      )}
      {error && !modal && !selectedRequest && (
        <p className="hub-error" role="alert">
          {error}
        </p>
      )}

      <div id="hub-panel" role="tabpanel" aria-labelledby={`hub-tab-${tab}`}>
        {overview.isLoading ? (
          <div className="hub-empty">
            <Loader2 className="hub-spin" aria-hidden="true" />
            <p>Loading your community…</p>
          </div>
        ) : overview.isError ? (
          <div className="hub-error" role="alert">
            <p>{(overview.error as Error).message}</p>
            <button type="button" className="hub-secondary" onClick={() => overview.refetch()}>
              Try again
            </button>
          </div>
        ) : (
          data && (
            // Same column rhythm as the page shell, without re-applying the
            // `.hub` block (which would double the gap and bottom padding).
            <div className="hub-panel-body">
              {!emailVerified && (
                <div className="hub-warning">
                  Verify your email to subscribe, submit requests or register a service.{" "}
                  <Link href="/verify-email" className="hub-link">
                    Email verification
                  </Link>
                </div>
              )}

              {tab === "overview" && (
                <>
                  <div className="hub-stats">
                    <div className="hub-stat">
                      <Building2 size={20} aria-hidden="true" />
                      <strong>{directory.length}</strong>
                      <span>Verified local services</span>
                    </div>
                    <div className="hub-stat">
                      <Users size={20} aria-hidden="true" />
                      <strong>{directory.filter((o) => o.following).length}</strong>
                      <span>Your subscriptions</span>
                    </div>
                    <div className="hub-stat">
                      <ClipboardList size={20} aria-hidden="true" />
                      <strong>
                        {data.requests.filter((r) => !["resolved", "closed"].includes(r.state)).length}
                      </strong>
                      <span>Open requests visible to you</span>
                    </div>
                    <div className="hub-stat">
                      <CheckCircle2 size={20} aria-hidden="true" />
                      <strong>
                        {data.requests.filter((r) => ["resolved", "closed"].includes(r.state)).length}
                      </strong>
                      <span>Resolved or closed</span>
                    </div>
                  </div>

                  <div className="hub-columns">
                    <section>
                      <div className="hub-section-title">
                        <div>
                          <p className="hub-eyebrow">From report to resolution</p>
                          <h2>Your latest requests</h2>
                        </div>
                        <button type="button" className="hub-link" onClick={() => setTab("requests")}>
                          View all <ArrowUpRight size={15} aria-hidden="true" />
                        </button>
                      </div>
                      {requestList(data.requests.slice(0, 5))}
                      <div className="hub-steps">
                        <span>
                          <b>01</b>Choose a service
                        </span>
                        <span>
                          <b>02</b>Share the details
                        </span>
                        <span>
                          <b>03</b>Follow progress
                        </span>
                      </div>
                    </section>

                    <aside className="hub-notices">
                      <h2>
                        <Bell size={20} aria-hidden="true" /> Community updates
                      </h2>
                      {data.notices.length ? (
                        data.notices.slice(0, 5).map((n) => (
                          <article key={n.id}>
                            <small>
                              {n.organisation_name} · {formatDate(n.created_at)}
                            </small>
                            <h3>{n.title}</h3>
                            <p>{n.body}</p>
                          </article>
                        ))
                      ) : (
                        <p className="hub-muted">
                          Updates from verified organisations will appear here when they publish.
                        </p>
                      )}
                    </aside>
                  </div>

                  <div className="hub-section-title">
                    <div>
                      <p className="hub-eyebrow">People who can help</p>
                      <h2>Services in your community</h2>
                    </div>
                    <button type="button" className="hub-link" onClick={() => setTab("directory")}>
                      Explore directory <ArrowUpRight size={15} aria-hidden="true" />
                    </button>
                  </div>
                  {directory.length ? (
                    <div className="hub-service-grid">{directory.slice(0, 4).map(organisationCard)}</div>
                  ) : (
                    <Empty title="Help build your local network">
                      No verified services are listed for this city yet. Register your organisation to
                      start the verification process.
                    </Empty>
                  )}
                </>
              )}

              {tab === "directory" && (
                <>
                  <div className="hub-section-title">
                    <div>
                      <h2>Find your local service</h2>
                      <p className="hub-muted">
                        Only verified organisations in {data.community.city} appear here.
                      </p>
                    </div>
                  </div>
                  <div className="hub-filters">
                    <label>
                      <Search size={17} aria-hidden="true" />
                      <input
                        aria-label="Search services"
                        placeholder="Search by name or service…"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                      />
                    </label>
                    <select
                      aria-label="Service type"
                      value={typeFilter}
                      onChange={(e) => setTypeFilter(e.target.value)}
                    >
                      <option value="">All service types</option>
                      {SERVICE_TYPES.map((t) => (
                        <option key={t} value={t}>
                          {SERVICE_LABELS[t]}
                        </option>
                      ))}
                    </select>
                  </div>
                  {visible.length ? (
                    <div className="hub-service-grid">{visible.map(organisationCard)}</div>
                  ) : (
                    <Empty title="No matching services">
                      Try a different search, or register a service for review.
                    </Empty>
                  )}
                </>
              )}

              {tab === "requests" && (
                <>
                  <div className="hub-section-title">
                    <div>
                      <h2>My requests</h2>
                      <p className="hub-muted">
                        Requests you raised, plus service work you are authorised to manage. Showing
                        the most recent 200.
                      </p>
                    </div>
                    <button
                      type="button"
                      className="hub-primary"
                      disabled={!directory.length || !emailVerified}
                      onClick={() => openModal("request")}
                    >
                      <Plus size={16} aria-hidden="true" /> New request
                    </button>
                  </div>
                  {requestList(data.requests)}
                </>
              )}

              {tab === "workspace" && (
                <>
                  <div className="hub-section-title">
                    <div>
                      <h2>Service workspace</h2>
                      <p className="hub-muted">
                        Review incoming requests, publish local updates and manage your team.
                      </p>
                    </div>
                  </div>

                  {unverifiedManaged.map((o) => (
                    <div className="hub-warning" key={o.id}>
                      <strong>
                        {o.name}: {o.status === "pending" ? "Awaiting verification" : "Not approved"}
                      </strong>
                      <p>
                        {o.review_note ||
                          "An administrator who does not own this application must verify the organisation before it can receive requests or publish updates."}
                      </p>
                    </div>
                  ))}

                  {verifiedManaged.length ? (
                    <>
                      {verifiedManaged.map((o) => (
                        <div className="hub-workspace-card" key={o.id}>
                          <div>
                            <h3>{o.name}</h3>
                            <p>
                              {SERVICE_LABELS[o.type]} · {o.city}
                            </p>
                          </div>
                          <button
                            type="button"
                            className="hub-secondary"
                            onClick={() => openModal("notice", o.id)}
                          >
                            Publish an update
                          </button>
                          {o.is_owner && <Team organisation={o} act={act} busy={busy} />}
                        </div>
                      ))}
                      {requestList(data.requests.filter((r) => r.can_manage))}
                    </>
                  ) : (
                    <Empty title="Bring your organisation on board">
                      Register a municipality, police station, fire brigade or security service.
                      Independent verification is required before the workspace becomes active.
                    </Empty>
                  )}
                </>
              )}

              {tab === "verification" && data.isAdmin && (
                <>
                  <h2>Organisation verification</h2>
                  <p className="hub-muted">
                    Independently confirm the organisation and the applicant's authority using
                    official contact channels — not the details supplied in the application. Record
                    the checks you performed. You cannot review your own application.
                  </p>
                  {review.isLoading ? (
                    <p className="hub-muted">Loading applications…</p>
                  ) : review.isError ? (
                    <div className="hub-error" role="alert">
                      <p>Unable to load applications.</p>
                      <button type="button" className="hub-secondary" onClick={() => review.refetch()}>
                        Retry
                      </button>
                    </div>
                  ) : review.data?.length ? (
                    review.data.map((o) => (
                      <form
                        className="hub-review"
                        key={o.id}
                        onSubmit={(e) => {
                          const values = readForm(e);
                          act(
                            () => api(`/verification/${o.id}`, "POST", values),
                            "Verification decision saved.",
                            false,
                          );
                        }}
                      >
                        <div>
                          <span className={`hub-status ${o.status}`}>{o.status}</span>
                          <h3>{o.name}</h3>
                          <p>
                            {SERVICE_LABELS[o.type]} · {o.city}, {o.country}
                          </p>
                          <p>{o.description}</p>
                          <p>
                            {o.contact_email} · {o.phone}
                          </p>
                          {o.website && <p>{o.website}</p>}
                          <small>
                            Applicant: {o.applicant_username} ({o.applicant_email}) · submitted{" "}
                            {formatDate(o.created_at)}
                          </small>
                        </div>
                        {o.is_own_application ? (
                          <p className="hub-warning">
                            This is your own application. Another administrator must review it.
                          </p>
                        ) : (
                          <>
                            <Field label="Decision">
                              <select name="status" defaultValue="verified">
                                <option value="verified">Verify organisation</option>
                                <option value="rejected">Reject / revoke verification</option>
                              </select>
                            </Field>
                            <Field label="Verification evidence or reason">
                              <textarea
                                name="note"
                                required
                                minLength={10}
                                maxLength={2000}
                                placeholder="Record the independent checks you carried out and the outcome"
                              />
                            </Field>
                            <button type="submit" className="hub-primary" disabled={busy}>
                              Save decision
                            </button>
                          </>
                        )}
                      </form>
                    ))
                  ) : (
                    <Empty title="Nothing to review">
                      Organisation applications will appear here when they are submitted.
                    </Empty>
                  )}
                </>
              )}
            </div>
          )
        )}
      </div>

      {modal && data && (
        <Modal title={MODAL_TITLES[modal]} onClose={() => !busy && setModal(null)}>
          {error && (
            <p className="hub-error" role="alert">
              {error}
            </p>
          )}

          {modal === "organisation" && (
            <form
              onSubmit={(e) => {
                const values = readForm(e);
                act(
                  () => api("/organisations", "POST", { ...values, ...data.community }),
                  "Organisation submitted for verification.",
                );
              }}
            >
              <p className="hub-muted">
                For organisations serving {data.community.city}. Submitting this grants no
                privileges: the listing stays private until an administrator who does not own it has
                independently verified it.
              </p>
              <Field label="Organisation name">
                <input name="name" required minLength={2} maxLength={120} />
              </Field>
              <Field label="Service type">
                <select name="type" defaultValue={SERVICE_TYPES[0]}>
                  {SERVICE_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {SERVICE_LABELS[t]}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="How you help the community">
                <textarea name="description" required minLength={2} maxLength={1200} />
              </Field>
              <div className="hub-form-row">
                <Field label="Public contact email">
                  <input name="contactEmail" type="email" required maxLength={254} />
                </Field>
                <Field label="Public contact phone">
                  <input name="phone" type="tel" required minLength={5} maxLength={40} />
                </Field>
              </div>
              <Field label="Official website (optional)">
                <input name="website" type="url" placeholder="https://" maxLength={500} />
              </Field>
              <button type="submit" className="hub-primary" disabled={busy}>
                {busy ? "Submitting…" : "Submit for verification"}
              </button>
            </form>
          )}

          {modal === "request" && (
            <form
              onSubmit={(e) => {
                const values = readForm(e);
                act(async () => {
                  await api("/requests", "POST", { ...values, idempotencyKey: requestKey });
                  // A new key for any subsequent request from this form.
                  setRequestKey(crypto.randomUUID());
                }, "Request submitted. You can track it under My requests.");
              }}
            >
              <p className="hub-warning">
                Non-emergency matters only. If anyone is in immediate danger, contact emergency
                services directly — this request is not dispatched to anyone.
              </p>
              <Field label="Send to">
                <select name="organisationId" required defaultValue={selectedOrg}>
                  <option value="">Choose a verified service</option>
                  {directory.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Category">
                <select name="category" defaultValue={REQUEST_CATEGORIES[0]}>
                  {REQUEST_CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {pretty(c)}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Brief title">
                <input
                  name="title"
                  required
                  minLength={2}
                  maxLength={140}
                  placeholder="e.g. Streetlight not working"
                />
              </Field>
              <Field label="What needs attention?">
                <textarea name="description" required minLength={2} maxLength={3000} />
              </Field>
              <div className="hub-form-row">
                <Field label="Neighbourhood">
                  <input
                    name="neighbourhood"
                    required
                    defaultValue={user?.neighbourhood || ""}
                    minLength={2}
                    maxLength={100}
                  />
                </Field>
                <Field label="Street or landmark">
                  <input name="location" required minLength={2} maxLength={240} />
                </Field>
              </div>
              <p className="hub-muted">
                These details are shared with this organisation's authorised team. Avoid
                unnecessary personal information.
              </p>
              <button type="submit" className="hub-primary" disabled={busy}>
                {busy ? "Submitting…" : "Submit request"}
              </button>
            </form>
          )}

          {modal === "notice" && (
            <form
              onSubmit={(e) => {
                const values = readForm(e);
                act(
                  () => api(`/organisations/${selectedOrg}/notices`, "POST", values),
                  "Community update published.",
                );
              }}
            >
              <p className="hub-muted">
                This update will be visible to approved users in {data.community.city}.
              </p>
              <Field label="Title">
                <input name="title" required minLength={2} maxLength={140} />
              </Field>
              <Field label="Update">
                <textarea name="body" required minLength={2} maxLength={2000} />
              </Field>
              <button type="submit" className="hub-primary" disabled={busy}>
                {busy ? "Publishing…" : "Publish update"}
              </button>
            </form>
          )}
        </Modal>
      )}

      {selectedRequest && (
        <Modal title={selectedRequest.title} onClose={() => !busy && setSelectedRequest(null)}>
          <p className="hub-muted">
            {selectedRequest.organisation_name} · Reference{" "}
            {selectedRequest.id.slice(0, 8).toUpperCase()}
          </p>
          <span className={`hub-status ${selectedRequest.state}`}>{pretty(selectedRequest.state)}</span>
          <p className="hub-detail">{selectedRequest.description}</p>
          <p className="hub-location">
            <MapPin size={14} aria-hidden="true" /> {selectedRequest.neighbourhood} ·{" "}
            {selectedRequest.location}
          </p>

          <h3 className="hub-timeline-title">Request history</h3>
          <ol className="hub-timeline">
            <li>
              <strong>Submitted</strong>
              <small>{formatDate(selectedRequest.created_at)}</small>
            </li>
            {updates.data?.map((u) => (
              <li key={u.id}>
                <strong>{pretty(u.state)}</strong>
                <small>{formatDate(u.created_at)}</small>
                <p>{u.note}</p>
              </li>
            ))}
          </ol>
          {updates.isLoading && <p className="hub-muted">Loading history…</p>}
          {updates.isError && (
            <div className="hub-error" role="alert">
              <p>Could not load the request history.</p>
              <button type="button" className="hub-secondary" onClick={() => updates.refetch()}>
                Retry
              </button>
            </div>
          )}
          {error && (
            <p className="hub-error" role="alert">
              {error}
            </p>
          )}

          {selectedRequest.can_manage && nextStates(selectedRequest.state).length > 0 && (
            <form
              onSubmit={(e) => {
                const values = readForm(e);
                act(
                  () =>
                    api(`/requests/${selectedRequest.id}/updates`, "POST", {
                      ...values,
                      version: selectedRequest.version,
                    }),
                  "Request updated.",
                );
              }}
            >
              <Field label="Next status">
                <select name="state" defaultValue={nextStates(selectedRequest.state)[0]}>
                  {nextStates(selectedRequest.state).map((s) => (
                    <option key={s} value={s}>
                      {pretty(s)}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Update for the resident">
                <textarea name="note" required minLength={2} maxLength={2000} />
              </Field>
              <button type="submit" className="hub-primary" disabled={busy}>
                {busy ? "Saving…" : "Save status update"}
              </button>
            </form>
          )}
        </Modal>
      )}
    </div>
  );
}

/** Owner-only staff management. Rendered only when `organisation.is_owner`. */
function Team({
  organisation,
  act,
  busy,
}: {
  organisation: ManagedOrganisation;
  act: (fn: () => Promise<unknown>, message: string, close?: boolean) => Promise<void>;
  busy: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const cache = useQueryClient();
  const { user } = useAuthStore();

  // Scoped to the viewer as well as the organisation. Keyed on the
  // organisation alone, a staff list — names and email addresses — cached by
  // one owner would be served to the next person to sign in on the same
  // device while the refetch was still in flight. Sign-out clears the cache
  // outright (client/src/lib/sessionTeardown.ts); this is the second line.
  const staffKey = ["service-staff", organisation.id, user?.id];

  const staff = useQuery<StaffMember[]>({
    queryKey: staffKey,
    queryFn: () => api<StaffMember[]>(`/organisations/${organisation.id}/staff`),
    enabled: open,
  });

  const invalidate = () => cache.invalidateQueries({ queryKey: staffKey });

  return (
    <details className="hub-team" onToggle={(e) => setOpen(e.currentTarget.open)}>
      <summary>Manage staff</summary>
      <p className="hub-muted">
        Staff can read this organisation's service requests, update their status and publish
        notices. They cannot add or remove other staff.
      </p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          act(
            async () => {
              await api(`/organisations/${organisation.id}/staff`, "POST", { email });
              await invalidate();
              setEmail("");
            },
            "Staff member added.",
            false,
          );
        }}
      >
        <Field label="Existing staff member's verified email">
          <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        <button type="submit" className="hub-secondary" disabled={busy}>
          Add staff member
        </button>
      </form>
      {staff.isError && (
        <div className="hub-error" role="alert">
          <p>Could not load staff.</p>
          <button type="button" className="hub-secondary" onClick={() => staff.refetch()}>
            Retry
          </button>
        </div>
      )}
      {staff.data?.map((s) => (
        <div className="hub-staff-row" key={s.id}>
          <span>
            {s.username} · {s.email}
          </span>
          <button
            type="button"
            className="hub-secondary"
            disabled={busy}
            onClick={() =>
              act(
                async () => {
                  await api(`/organisations/${organisation.id}/staff/${s.id}`, "DELETE");
                  await invalidate();
                },
                "Staff access removed.",
                false,
              )
            }
          >
            Remove access
          </button>
        </div>
      ))}
      {staff.data?.length === 0 && <p className="hub-muted">No staff added yet.</p>}
    </details>
  );
}
