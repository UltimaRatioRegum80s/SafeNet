// client/src/state/useQuickReportStore.ts
import { create } from "zustand";
import type { Severity } from "@/features/report/incidentTypes";

export type IncidentTypeId = string;

type LatLng = { lat: number; lng: number };

type QuickReportState = {
  isOpen: boolean;
  type?: IncidentTypeId;
  severity?: Severity;
  note: string;
  location?: LatLng;

  // ⬇️ NEW: desktop tap-to-report support
  reportMode: boolean;   // when true, map waits for click to set location
  tempPin?: LatLng;      // optional pre-confirm preview
  pendingReportMode: boolean; // NEW: queue start after sheet closes
  
  open: (p: { type: IncidentTypeId; severity: Severity }) => void;
  close: () => void;
  setNote: (note: string) => void;
  setLocation: (ll?: LatLng) => void;
  reset: () => void;

  // ⬇️ NEW actions for desktop flow
  startReportMode: () => void;
  cancelReportMode: () => void;
  confirmTempPin: (ll: LatLng) => void;
  resetReportContext: () => void; // NEW
  queueReportMode: () => void;     // NEW
  consumePendingReportMode: () => void; // NEW
};

export const useQuickReportStore = create<QuickReportState>((set) => ({
  isOpen: false,
  type: undefined,
  severity: undefined,
  note: "",
  reportMode: false,
  pendingReportMode: false,
  open: ({ type, severity }) => set({ isOpen: true, type, severity, note: "" }),
  close: () => set({ isOpen: false }),
  setNote: (note) => set({ note }),
  setLocation: (ll) => set({ location: ll }),
  reset: () => set({ 
    isOpen: false, 
    type: undefined, 
    severity: undefined, 
    note: "",
    reportMode: false,
    tempPin: undefined,
    location: undefined
  }),

  // desktop flow
  startReportMode: () => set({ reportMode: true, tempPin: undefined }),
  cancelReportMode: () => set({ reportMode: false, tempPin: undefined }),
  confirmTempPin: (ll) =>
    set({
      tempPin: ll,
      location: ll,
      isOpen: true,   // open sheet after user clicks the map
      reportMode: false,
    }),
  resetReportContext: () =>
    set({
      tempPin: undefined,
      location: undefined,
      reportMode: false,
      // note/category left intact so user can file another quickly; wipe if you prefer
    }),
  queueReportMode: () => set({ pendingReportMode: true }),
  consumePendingReportMode: () => set({ pendingReportMode: false }),
}));