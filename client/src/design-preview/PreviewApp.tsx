/**
 * Design-slice preview harness.
 *
 * Local review only. This is a second Vite HTML entry (client/design-preview.html)
 * and is NOT part of the production bundle: `vite build` only takes
 * client/index.html, and no application route renders any of this. It has no
 * API calls, no auth and no database. Every value on screen is fixture data
 * from features/redesign/fixtures.ts, and the banner at the top says so.
 *
 * Run it with:  npx vite   →   http://localhost:5173/design-preview.html
 */
import { useEffect, useState } from "react";
import { ThemeProvider, useTheme } from "@/components/ThemeProvider";
import { BottomNav, BOTTOM_NAV_SPACER, type NavKey } from "@/features/redesign/BottomNav";
import { HomeSlice } from "@/features/redesign/HomeSlice";
import { ReportEntrySlice } from "@/features/redesign/ReportEntrySlice";
import { ServicesSlice, StaffQueueSlice } from "@/features/redesign/ServicesSlice";
import {
  AREA,
  EMPTY_ACTIVITY,
  POPULATED_ACTIVITY,
  POPULATED_NOTICES,
  POPULATED_ORGANISATIONS,
  POPULATED_REQUESTS,
  STAFF_QUEUE,
} from "@/features/redesign/fixtures";
import "@/index.css";

type Screen = "home" | "report" | "services" | "staff";
type DataState = "empty" | "populated";
type LocationMode = "gps" | "no-gps";

const SCREENS: { id: Screen; label: string }[] = [
  { id: "home", label: "Home" },
  { id: "report", label: "Report" },
  { id: "services", label: "Services" },
  { id: "staff", label: "Staff queue" },
];

const NAV_FOR_SCREEN: Record<Screen, NavKey> = {
  home: "home",
  report: "report",
  services: "services",
  staff: "services",
};

/** Read the initial state from the query string so a screenshot run can pin it. */
function initialFromQuery<T extends string>(key: string, fallback: T, allowed: readonly T[]): T {
  const value = new URLSearchParams(window.location.search).get(key) as T | null;
  return value && allowed.includes(value) ? value : fallback;
}

function PreviewBody() {
  const { theme, setTheme } = useTheme();
  const [screen, setScreen] = useState<Screen>(() =>
    initialFromQuery<Screen>("screen", "home", ["home", "report", "services", "staff"]),
  );
  const [data, setData] = useState<DataState>(() =>
    initialFromQuery<DataState>("data", "empty", ["empty", "populated"]),
  );
  const [locationMode, setLocationMode] = useState<LocationMode>(() =>
    initialFromQuery<LocationMode>("location", "gps", ["gps", "no-gps"]),
  );
  const [chrome, setChrome] = useState(
    () => new URLSearchParams(window.location.search).get("chrome") !== "0",
  );
  const [log, setLog] = useState<string | null>(null);

  // Let a screenshot run force a theme with ?theme=dark.
  useEffect(() => {
    const wanted = new URLSearchParams(window.location.search).get("theme");
    if (wanted === "dark" || wanted === "light") setTheme(wanted);
  }, [setTheme]);

  const populated = data === "populated";
  const hasGps = locationMode === "gps";

  const onAction = (action: string) => {
    setLog(action);
    if (action === "report") setScreen("report");
    if (action === "services") setScreen("services");
    if (action === "staff-workspace") setScreen("staff");
    if (action === "activity") setLog("would open /community/feed");
  };

  return (
    <div className="min-h-dvh bg-background text-foreground">
      {chrome && (
        <div className="sticky top-0 z-[70] border-b border-amber-500/40 bg-amber-500/15 px-3 py-2 text-[11px] leading-tight text-amber-800 dark:text-amber-200">
          <p className="font-semibold">
            Design preview — fixture data, not production. Nothing here is saved
            or sent.
          </p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {SCREENS.map((s) => (
              <Chip
                key={s.id}
                label={s.label}
                active={screen === s.id}
                onClick={() => setScreen(s.id)}
              />
            ))}
            <span className="w-full" />
            <Chip
              label={populated ? "Populated" : "Empty"}
              active
              onClick={() => setData(populated ? "empty" : "populated")}
            />
            <Chip
              label={hasGps ? "GPS on" : "GPS unavailable"}
              active
              onClick={() => setLocationMode(hasGps ? "no-gps" : "gps")}
            />
            <Chip
              label={theme === "dark" ? "Dark" : "Light"}
              active
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            />
            <Chip label="Hide bar" active={false} onClick={() => setChrome(false)} />
          </div>
          {log && <p className="mt-1 opacity-70">last action: {log}</p>}
        </div>
      )}

      {/* Desktop keeps the app's existing labelled top navigation; the bottom
          bar is phone/tablet only. Shown here so the desktop shape of the
          slice can be reviewed alongside the mobile one. */}
      <div className="hidden border-b border-border xl:block">
        <div className="mx-auto flex max-w-5xl items-center gap-6 px-4 py-3 text-sm">
          <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-primary">
            NaborNet
          </span>
          {[
            { key: "home", label: "Home" },
            { key: "map", label: "Map" },
            { key: "activity", label: "Activity" },
            { key: "services", label: "Services" },
          ].map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => {
                if (item.key === "home") setScreen("home");
                if (item.key === "services") setScreen("services");
              }}
              className={
                NAV_FOR_SCREEN[screen] === item.key
                  ? "font-semibold text-foreground"
                  : "text-muted-foreground"
              }
            >
              {item.label}
            </button>
          ))}
          {/* No Report entry here: the app currently hides Report from the
              desktop navigation. Home's own Report action is the single
              desktop entry point in this slice — see the handover, which
              raises that as a decision for review. */}
        </div>
      </div>

      <div style={{ paddingBottom: BOTTOM_NAV_SPACER }}>
        {screen === "home" && (
          <HomeSlice
            area={AREA}
            hasPreciseLocation={hasGps}
            activity={populated ? POPULATED_ACTIVITY : EMPTY_ACTIVITY}
            requests={populated ? POPULATED_REQUESTS : []}
            notices={populated ? POPULATED_NOTICES : []}
            onAction={onAction}
          />
        )}

        {screen === "report" && (
          <ReportEntrySlice
            area={AREA}
            organisations={
              populated
                ? POPULATED_ORGANISATIONS.map((o) => ({ id: o.id, name: o.name }))
                : []
            }
            location={
              hasGps
                ? {
                    status: "ready",
                    label: "Sam Nujoma Ave, near the corner of Nathaniel Maxuilili St",
                    coords: { lat: -22.6792, lng: 14.5272 },
                  }
                : {
                    status: "unavailable",
                    reason:
                      "Your browser is not sharing location with NaborNet.",
                  }
            }
            onAction={onAction}
          />
        )}

        {screen === "services" && (
          <ServicesSlice
            area={AREA}
            organisations={populated ? POPULATED_ORGANISATIONS : []}
            requests={populated ? POPULATED_REQUESTS : []}
            isStaff={populated}
            onAction={onAction}
          />
        )}

        {screen === "staff" && (
          <StaffQueueSlice
            organisation="Example Town Water (sample)"
            queue={STAFF_QUEUE}
            onAction={onAction}
          />
        )}
      </div>

      <BottomNav
        active={NAV_FOR_SCREEN[screen]}
        onNavigate={(key) => {
          if (key === "home") setScreen("home");
          else if (key === "report") setScreen("report");
          else if (key === "services") setScreen("services");
          else setLog(`would navigate to ${key}`);
        }}
      />
    </div>
  );
}

function Chip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-2 py-1 font-medium ${
        active
          ? "border-amber-600/50 bg-amber-600/20"
          : "border-amber-600/30"
      }`}
    >
      {label}
    </button>
  );
}

export default function PreviewApp() {
  return (
    <ThemeProvider defaultTheme="light" storageKey="nabornet-preview-theme">
      <PreviewBody />
    </ThemeProvider>
  );
}
