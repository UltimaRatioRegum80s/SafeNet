import * as React from "react";
import { TopBar } from "./TopBar";
import MobileFloatingTopMenu from "../MobileFloatingTopMenu";
import FloatingThemeToggle from "../FloatingThemeToggle";
import { EmailVerificationBanner } from "../EmailVerificationBanner";
import { KenyaFieldTestBadge } from "../KenyaFieldTestBadge";

export default function AppLayout({
  title,
  actions,
  children,
  thirdRow,
  hideNavOnMobile = false,
}: {
  title: string;
  actions?: any;
  children: React.ReactNode;
  thirdRow?: React.ReactNode;
  hideNavOnMobile?: boolean;
}) {
  return (
    <div className="min-h-dvh bg-background text-foreground">
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
      
      {thirdRow}
      <main className={`mx-auto w-full max-w-screen-md px-3 md:px-4 py-3 xl:py-3 ${hideNavOnMobile ? 'max-md:px-0 max-md:pt-0' : 'max-xl:pt-20'}`}>
        {children}
      </main>
    </div>
  );
}