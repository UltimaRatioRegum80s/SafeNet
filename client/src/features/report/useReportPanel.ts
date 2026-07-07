import { create } from "zustand";

export type IncidentType = {
  id: string;
  label: string;
  severity: "low" | "medium" | "high" | "critical";
  iconSrc?: string; // we'll swap icon set later
};

type ReportPanelState = {
  open: boolean;
  selected: IncidentType | null;
  openWith: (t: IncidentType) => void;
  close: () => void;
};

export const useReportPanel = create<ReportPanelState>((set) => ({
  open: false,
  selected: null,
  openWith: (t) => set({ open: true, selected: t }),
  close: () => set({ open: false, selected: null }),
}));