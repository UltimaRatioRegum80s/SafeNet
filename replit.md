# NaborNet - Neighborhood Safety Community Platform

## Overview

NaborNet is a community safety and situational awareness platform delivered as an offline-capable Progressive Web App (PWA). Its core purpose is to enable communities to share unverified observations of incidents to improve awareness, especially in environments with limited connectivity. NaborNet is designed to be a "Safety-Grade MVP," prioritizing a conservative, legally defensible, and intentionally restrained approach. It is not intended to be an emergency service, a policing tool, or a source of verified facts. The project aims to provide a high-level situational overview, answering "Is anything happening near me?" quickly and efficiently.

## User Preferences

- **Communication style:** Simple, everyday language
- **Geographic focus:** Namibia (primary), Kenya (private field testing)
- **Location Service (Dual-Mode Behavior):**
    - **Reading data (Feed/Dashboard/Map):** City-coordinate fallback used when GPS is unavailable. `useCityFallbackCoords()` hook resolves `user.city` via `getCityCoordinates`. Soft informational banner shown, data always displayed.
    - **Writing data (Report):** Requires active GPS (current or stale). Report links/buttons are hidden (desktop) or disabled (mobile without GPS) in GlobalNavLinks, FeedChrome PrimaryNav, SimpleMapView LongPressFAB, and MobileMapChrome.
    - Map: Requires valid GPS, stale location, city fallback, or explicit focus params (focus/incident/lat+lng) to render; shows location required UI otherwise
    - Post-submit navigation: Uses `focus=incidentId` for guaranteed map centering even without GPS
    - No silent defaults: Hardcoded Windhoek coordinates removed from Feed and Map logic; only used temporarily when navigating via focus param (map re-centers on incident immediately)
    - Desktop users: Report nav item hidden entirely (desktop users don't post incidents)
- **GPS Jitter & Map Stability (PERMANENT):**
    - Coordinate Quantization: GPS coordinates quantized to 3 decimal places (~110m precision) to prevent cache key churn from minor GPS jitter
    - Query Key Stability: React Query key uses quantized coords, preventing empty-state flashes when GPS updates slightly
    - Placeholder Data: Feed maintains previous data during refetch via `placeholderData` callback
    - User Interaction Lockout (PERMANENT): Map tracks `hasUserInteracted` via dragstart, zoomstart, movestart, and touchstart events. Once set, this flag is PERMANENT for the component lifecycle - no programmatic viewport changes allowed after user interaction.
    - Programmatic Move Detection: `isProgrammaticMove` flag wraps all programmatic setView/fitBounds calls; reset via moveend/zoomend events (not timers)
    - One-Shot Auto-Center: Map auto-fits to incidents only on initial load (`didInitialAutoFit`), never overriding user pans/zooms
    - One-Shot Focus: Focus centering tracked by `lastFocusedCoordsRef` - same coords won't trigger repeated centering
    - localStorage Fallback Guard: Last-incident localStorage fallback runs once only (`hasAppliedLocalStorageFallback`)
    - All Viewport Changes Guarded: CenterEffect, auto-fit, focus, localStorage fallback, postAddMobileRefresh all check `hasUserInteracted` before any viewport change
    - Exception: zoomToIncident: Explicit user actions (clicking incident in list) are allowed even after interaction, but marked as programmatic to prevent false-positive interaction detection

## System Architecture

### Frontend
- **Error Handling:** `ErrorBoundary` component wraps the `Router` in `App.tsx` — catches render errors and shows a friendly recovery screen instead of a blank page.
- **Frameworks:** React, TypeScript, Vite
- **State Management:** Zustand (client-side), React Query (server state)
- **UI/UX:** shadcn/ui (Radix UI primitives), Tailwind CSS
- **Routing:** Wouter
- **PWA Capabilities:** Service Worker v2.x, installable manifest, A2HS prompts
- **Offline Capabilities:** IndexedDB for local draft storage, foreground sync with idempotency, offline location precision reduction.

### Backend
- **Runtime:** Node.js / Express
- **Database:** PostgreSQL (primary), IndexedDB (offline client storage)
- **ORM:** Drizzle ORM
- **Authentication:** Session-based (PostgreSQL store), mandatory email verification, password reset, login rate limiting. Users table uses `passwordHash` column only — legacy `password` column removed (March 2026).
- **Realtime:** Socket.IO
- **Email:** Resend (sandbox mode)

### Public Landing & Trust Pages
- **Landing Page (`/`):** Hero section with branding, "What NaborNet is" / "What NaborNet is NOT" clarity, PWA install guidance (Android/iOS), adaptive CTAs
- **About (`/about`):** Purpose, principles, community-driven approach
- **How It Works (`/how-it-works`):** 5-step guide with clear disclaimers about unverified information
- **Safety (`/safety`):** Emergency contacts (Namibia 10111, Kenya 999/112), limitations, safe use guidelines, legal notice
- **Routing:** Public pages accessible to all users regardless of auth state; `/community/*` remains gated

### Core Features
- **Location-Based Feed:** Displays incidents within a configurable radius of the user's location, with filtering options for time window, category, and severity.
- **Incident Responses (Structured Reactions):** Users can respond to incidents with predefined signals (e.g., `seen`, `caution`, `helpful`, `resolved`). This is designed to reduce legal exposure by avoiding free-text comments.
- **Home Page Lightweight Insights:** Provides a calm, read-only situational overview with incident counts categorized by urgency, based on the user's location.
- **Map/Feed Filter Parity:** URL-driven filtering ensures synchronization between Feed and Map views:
    - Shared params: `radiusKm` (1|3|5|10, default 5), `sinceHours` (24|72|168, default 72), `group` (services|nabor_note|emergency|critical)
    - Defaults omitted from URL (e.g., 5km/72h produces no query params)
    - Navigation between /community/feed and /community/map preserves filter params via click-time href computation (buildHref pattern)
    - Both views read from URL, ensuring identical queries with same params
- **Reporting Acceleration:** Introduces a long-press submission option for critical incident types to reduce reporting time in high-stress situations.

### Access Gate & Social Login (Phase 3D-A)
- **Google OAuth:** Passport.js with `passport-google-oauth20`, callback at `/api/auth/google/callback`
- **Access Status:** New users default to `pending`; existing users set to `approved` on migration
- **Access Gate Middleware:** All `/api/` routes (except auth, legal, version, ping, healthz, access, admin, e2e) check `access_status`; pending/denied users get 403
- **Frontend Gate:** App.tsx Router checks `user.accessStatus` — pending users see `/pending`, denied see `/access-denied`, approved see community
- **Admin Approval:** `/admin/access` page for admins (ADMIN_EMAILS env var: nabornetinfo@gmail.com, dwmoolman@gmail.com) to list/approve/deny requests
- **Pending Page:** `/pending` lets users submit name, city, reason while awaiting approval
- **OAuth User Creation:** New Google OAuth users created with `access_status=pending`, `emailVerified=true`, empty country/city (filled via pending form)
- **Microsoft OAuth:** Planned for later (passport-microsoft installed but not configured)

### Operational Controls
- **Closed Beta:** `SIGNUP_MODE: whitelist`, `INCIDENT_CREATION_ENABLED` and `OFFLINE_SYNC_ENABLED` kill switches.
- **Legal & Compliance:** Terms of Service, Privacy Policy, LegalGate for consent, disclaimers.
- **Incident Integrity:** Client-generated UUIDs and `idempotency_key` prevent duplicate incidents.

## External Dependencies

### Third-Party Libraries
- **Leaflet / MapLibre:** Mapping functionalities.
- **Radix UI:** Provides accessible UI primitives.
- **React Query:** Manages server state.
- **Zustand:** Manages client-side state.
- **Resend:** Used for email delivery services.
- **Socket.IO:** Facilitates realtime communication.
- **Passport.js:** OAuth authentication (Google, Microsoft planned).

### Development Tools
- **Vite:** Serves as the build tool for the project.
- **TypeScript:** The primary language used for development.
- **Tailwind CSS:** Utilized for styling the user interface.
- **Drizzle ORM:** Employed for database schema definition and querying.

## Domain Migration (nabornet.io)

**Migrated: February 2026**

### Configuration
- **Production domain:** https://nabornet.io
- **APP_URL:** Set in production environment (used for email links, absolute URLs)
- **Session cookies:** `SameSite=Lax`, `Secure=true` on HTTPS, domain-agnostic (no hardcoded domain)
- **CORS:** `origin: true` (allows any request origin); Socket.IO uses `origin: "*"`
- **Service Worker:** Uses `self.location.origin` dynamically (no hardcoded domain)
- **Manifest:** Relative URLs (`/`, `/community/map`, etc.) - works on any domain

### Tester Instructions (Post-Migration)
If experiencing stale content or login issues on nabornet.io:

1. **Hard refresh:** Ctrl+Shift+R (Windows/Linux) or Cmd+Shift+R (Mac)
2. **Clear site data (recommended for fresh start):**
   - Chrome: DevTools → Application → Storage → Clear site data
   - Safari: Settings → Privacy → Manage Website Data → Remove nabornet.io
   - Firefox: DevTools → Storage → Clear All
3. **Service Worker:** Currently disabled for deployment debugging; old SW will auto-unregister

### Old Domain Redirect Strategy
- **Replit hosting limitation:** Replit does not support custom redirects from old `.replit.app` domains to custom domains
- **Behavior:** Old Replit domain will continue to work if accessed directly, but production users should use nabornet.io
- **Email links:** All new verification/reset emails use APP_URL (nabornet.io) - no mixed-domain links

### Verification Checklist
- [ ] `/` and trust pages load on nabornet.io
- [ ] `/community/*` remains gated (requires auth)
- [ ] Login persists after refresh and navigation
- [ ] Email verification links use nabornet.io domain
- [ ] `/api/version` shows correct deployment
- [ ] PWA install works on Android/iOS