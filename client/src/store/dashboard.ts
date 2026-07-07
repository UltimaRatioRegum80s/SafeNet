import { create } from 'zustand';
import { DashboardData, Incident, CheckIn } from '../types';

interface DashboardState {
  data: DashboardData | null;
  incidents: Incident[];
  checkins: CheckIn[];
  loading: boolean;
  setData: (data: DashboardData) => void;
  setIncidents: (incidents: Incident[]) => void;
  setCheckins: (checkins: CheckIn[]) => void;
  setLoading: (loading: boolean) => void;
}

export const useDashboardStore = create<DashboardState>((set) => ({
  data: null,
  incidents: [],
  checkins: [],
  loading: false,
  setData: (data) => set({ data }),
  setIncidents: (incidents) => set({ incidents }),
  setCheckins: (checkins) => set({ checkins }),
  setLoading: (loading) => set({ loading }),
}));
