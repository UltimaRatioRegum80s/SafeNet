import * as React from "react";
import { TopBar } from "./TopBar";
import MobileFloatingTopMenu from "../MobileFloatingTopMenu";
import FloatingThemeToggle from "../FloatingThemeToggle";
import { EmailVerificationBanner } from "../EmailVerificationBanner";
import { KenyaFieldTestBadge } from "../KenyaFieldTestBadge";

/**
 * The layout owns the top chrome stack.
 *
 * On mobile the navigation dock and the theme toggle are `fixed`, so nothing
 * below them reserves space automatically. Pages used to compensate with their
 * own offsets — `max-xl:pt-20` here, `top:calc(env(safe-area-inset-top)+80px)`
 * in the Feed — and the Feed, which renders through `pageChrome`, had no offset
 * at all. The result was the navigation dock, the emergency notice, the filter
 * row and the location banner all overlapping on a phone.
 *
 * Now there is one reserved height, `--nn-top-chrome`, published on the layout
 * root. Everything below the fixed dock starts after it, and a page that needs
 * to pin its own bar (the Feed filters) sticks to the same value.
 */
export default function AppLayout({
  title,
  actions,
  children,
  pageChrome,
  hideNavOnMobile = false,
}: {
  title: string;
  actions?: any;
  children: React.ReactNode;
  /**
   * Full-bleed content that replaces the centred `main` column — used by the
   * Feed, which manages its own width and sticky filter bar. It is placed
   * inside the reserved space, not above it.
   */
  pageChrome?: React.ReactNode;
  hideNavOnMobile?: boolean;
}) {
  return (
    <div
      // --nn-top-chrome is the height of the layout's own fixed chrome: zero on
      // desktop, and on mobile the bottom edge of the floating navigation dock
      // (safe area + 12px offset + 58px dock). Consumers add their own gap.
      className="min-h-dvh bg-background text-foreground [--nn-top-chrome:0px] max-xl:[--nn-top-chrome:calc(env(safe-area-inset-top,0px)+70px)]"
    >
      {/* Persistent email verification banner for unverified users */}
      <EmailVerificationBanner variant="banner" />

      {/* Kenya Field Test badge - shown when in Kenya with field test enabled */}
      <KenyaFieldTestBadge />

      {/* Desktop: Show full TopBar. Mobile: Hide TopBar, show floating nav instead */}
      <TopBar
        title={title}
        actions={actions}
        className="max-xl:hidden"
      />

      {/* Mobile Floating Navigation - shown on all pages in mobile view */}
      <MobileFloatingTopMenu />

      {/* Mobile Floating Theme Toggle - top right, independent from nav bar */}
      <FloatingThemeToggle />

      {pageChrome ? (
        <div style={{ paddingTop: "var(--nn-top-chrome)" }}>{pageChrome}</div>
      ) : (
        <main
          className={`mx-auto w-full max-w-screen-md px-3 md:px-4 pb-3 ${
            hideNavOnMobile ? "max-md:px-0 max-md:pt-0 pt-3" : ""
          }`}
          style={
            hideNavOnMobile
              ? undefined
              : { paddingTop: "calc(var(--nn-top-chrome) + 0.75rem)" }
          }
        >
          {children}
        </main>
      )}
    </div>
  );
}
