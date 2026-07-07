import { create } from "zustand";

export type Severity = "low" | "medium" | "high" | "critical";
export type TimeRange = "all" | "1hour" | "6hours" | "12hours" | "24h" | "7d" | "30d";
export type BBox = { north:number; south:number; east:number; west:number } | null;

type Incident = {
  id: string;
  type: string;
  status: "pending" | "approved" | "rejected";
  lat?: number; 
  lng?: number;
  createdAt: string;
  title?: string;
  description?: string;
  severity?: Severity;
  isAnonymous?: boolean;
  optimistic?: boolean;
};

type S = {
  selectedId: string | null;
  setSelectedId: (id: string | null) => void;

  severity: Severity | "all";
  setSeverity: (s: S["severity"]) => void;

  timeRange: TimeRange;
  setTimeRange: (t: TimeRange) => void;

  inViewOnly: boolean;
  toggleInViewOnly: () => void;

  bbox: BBox;
  setBBox: (b: BBox) => void;
  
  // Incident data management
  incidents: Incident[];
  addIncident: (i: Incident) => void;
  removeIncident: (id: string) => void;
  updateIncidentId: (tempId: string, newId: string) => void;
  reconcileIncident: (tempId: string, real: Incident) => void;
};

export const useIncidentStore = create<S>()((set, get) => ({
  selectedId: null,
  setSelectedId: (id) => set({ selectedId: id }),

  severity: "all",
  setSeverity: (s) => set({ severity: s }),

  timeRange: "all",
  setTimeRange: (t) => set({ timeRange: t }),

  inViewOnly: false, // Show all incidents on startup, user can toggle view filter later
  toggleInViewOnly: () => set((s) => ({ inViewOnly: !s.inViewOnly })),

  bbox: null,
  setBBox: (b) => set({ bbox: b }),
  
  // Incident data management
  incidents: get()?.incidents ?? [],
  addIncident: (i) => set((s) => ({ incidents: [i, ...(s.incidents ?? [])] })),
  removeIncident: (id) => set((s) => ({ incidents: (s.incidents ?? []).filter(x => x.id !== id) })),
  updateIncidentId: (tempId, newId) =>
    set((s) => ({
      incidents: (s.incidents ?? []).map(x =>
        x.id === tempId ? { ...x, id: newId, optimistic: false } : x
      ),
    })),
  reconcileIncident: (tempId, real) =>
    set((s) => ({
      incidents: (s.incidents ?? []).map(x => x.id === tempId ? real : x),
    })),
}));