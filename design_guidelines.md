# NaborNet Design Guidelines

## Design Approach

**Reference-Based**: Drawing from Citizen App's urgency-driven UI, Apple Maps' clarity, and modern mobile-first patterns (iOS/Android 2025 design language). Emphasize trust, speed, and glanceable information.

**Core Principles**:
- Glassmorphism for depth without visual weight
- Information hierarchy through severity color coding
- Instant recognition of critical vs. routine incidents
- One-handed mobile operation priority

## Typography

**Font Stack**: Inter (primary) via Google Fonts CDN
- Headlines: 24-32px, font-semibold
- Card titles: 16-18px, font-medium
- Body text: 14px, font-normal
- Timestamps/metadata: 12px, font-normal, reduced opacity
- Map markers/labels: 13px, font-semibold

## Layout System

**Spacing Primitives**: Tailwind units of 2, 3, 4, 6, 8
- Component padding: p-4, p-6
- Stack spacing: space-y-3, space-y-4
- Card gaps: gap-3, gap-4
- Section margins: mb-6, mb-8

**Container Strategy**:
- Full-width map viewport with overlay UI
- Floating cards: max-w-md mx-auto px-4
- Bottom sheets: w-full with rounded-t-3xl

## Core Components

### Glassmorphic Navigation (Top)
Fixed position with backdrop-blur-xl, semi-transparent background. Left: menu icon, Center: location name, Right: profile avatar. Height: h-16. Use shadow-lg for depth.

### Map Interface (Primary View)
Full-screen map (100vh minus nav height). Cluster markers by severity using color-coded pins. Floating zoom controls bottom-right. Current location button with pulse effect.

### Incident Cards (Map Overlays)
Glassmorphic cards (backdrop-blur-lg) appearing on tap. Structure:
- Severity indicator strip (h-1 top border in yellow/amber/red)
- Icon + incident type (18px)
- Time ago + distance
- Brief description (2 lines max)
- Action buttons: "View Details" (primary), "Get Directions" (secondary)

Card treatments: rounded-2xl, p-4, shadow-2xl

### Bottom Navigation Bar
Fixed bottom with 4-5 tabs: Map, Reports, Alerts, Community, Profile. Glassmorphic treatment (backdrop-blur-xl), height h-20, safe-area-inset-bottom for iOS.

### Incident Feed (Alternative View)
Vertical scroll list, each item: 
- Left: severity color bar (w-1)
- Center: Icon, type, location, time
- Right: Distance indicator
Full-bleed tap targets (h-20 minimum)

### Alert Banner (Critical Incidents)
Top-of-screen sliding banner with red severity, bold text, "View Now" CTA. Dismissible with X. Uses blur background for visibility over map.

### Report Incident FAB
Large circular button (w-16 h-16) bottom-right, elevated (shadow-2xl), primary accent. Expands to multi-option menu: Quick Report types with icons.

### Detail Modal (Bottom Sheet)
Slides up from bottom, rounded-t-3xl. Sections:
- Severity header with icon
- Full incident details
- Photo gallery (if applicable)
- Map snippet showing location
- Related incidents nearby
- Comment thread
Drag handle at top for dismiss.

## Images

**Image Strategy**:
1. **Onboarding Hero**: Community illustration showing diverse neighbors collaborating. Warm, trustworthy aesthetic. Above fold, 60vh height on mobile.
2. **Incident Photos**: User-submitted images within detail modals, 4:3 aspect ratio, rounded-xl, in horizontal scroll gallery.
3. **Empty States**: Friendly illustrations for "No incidents nearby" with optimistic messaging.
4. **Profile Avatars**: Circular, 40px in navigation, 80px in profiles.

**No traditional hero on main app** - map IS the hero. Onboarding only uses hero imagery.

## Severity Color System (Applied to indicators only)

Use color-coded left borders, top strips, and marker pins:
- Yellow: Low severity (informational)
- Amber: Medium severity (caution)
- Red: High severity (urgent)

Apply to card accents, map pins, alert banners. Maintain WCAG contrast in both themes.

## Interactions

- Pull-to-refresh on feeds
- Swipe-to-dismiss on cards
- Long-press on map to quick-report
- Haptic feedback on critical actions (iOS/Android)
- Smooth 300ms transitions for modals
- Minimal animations - focus on responsiveness

## Icon Library

**Heroicons** (outline for navigation, solid for incident types) via CDN. Categories: Alert, Fire, Theft, Medical, Traffic, Suspicious Activity, Wildlife.