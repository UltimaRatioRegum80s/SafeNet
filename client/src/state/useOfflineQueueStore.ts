import { create } from "zustand";
import { 
  enqueueIncident, 
  getAllLocalIncidents, 
  getPendingCount,
  getErrorCount,
  markForRetry,
  removeIncident,
  type PendingIncident,
  type SyncStatus
} from "@/lib/offlineDb";
import { syncPendingIncidents } from "@/lib/syncEngine";

interface OfflineQueueState {
  pendingCount: number;
  errorCount: number;
  isOnline: boolean;
  isSyncing: boolean;
  localIncidents: PendingIncident[];
  enqueue: (incident: {
    type: string;
    title: string;
    description: string;
    latitude: number;
    longitude: number;
    severity: 'low' | 'medium' | 'high' | 'critical';
  }) => Promise<PendingIncident>;
  sync: () => Promise<void>;
  retryIncident: (id: string) => Promise<void>;
  removeIncident: (id: string) => Promise<void>;
  refreshCounts: () => Promise<void>;
  refreshLocalIncidents: () => Promise<void>;
}

export const useOfflineQueueStore = create<OfflineQueueState>((set, get) => ({
  pendingCount: 0,
  errorCount: 0,
  isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
  isSyncing: false,
  localIncidents: [],

  enqueue: async (incident) => {
    const pendingIncident = await enqueueIncident({
      ...incident,
      createdAt: Date.now(),
    });
    
    await get().refreshCounts();
    await get().refreshLocalIncidents();
    
    if (navigator.onLine) {
      get().sync();
    }
    
    return pendingIncident;
  },

  sync: async () => {
    if (get().isSyncing) return;
    
    set({ isSyncing: true });
    try {
      await syncPendingIncidents();
      await get().refreshCounts();
      await get().refreshLocalIncidents();
    } finally {
      set({ isSyncing: false });
    }
  },

  retryIncident: async (id: string) => {
    await markForRetry(id);
    await get().refreshCounts();
    await get().refreshLocalIncidents();
    
    if (navigator.onLine) {
      get().sync();
    }
  },

  removeIncident: async (id: string) => {
    await removeIncident(id);
    await get().refreshCounts();
    await get().refreshLocalIncidents();
  },

  refreshCounts: async () => {
    const [pending, errors] = await Promise.all([
      getPendingCount(),
      getErrorCount()
    ]);
    set({ pendingCount: pending, errorCount: errors });
  },

  refreshLocalIncidents: async () => {
    const incidents = await getAllLocalIncidents();
    set({ localIncidents: incidents });
  },
}));

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    useOfflineQueueStore.setState({ isOnline: true });
    useOfflineQueueStore.getState().sync();
  });

  window.addEventListener('offline', () => {
    useOfflineQueueStore.setState({ isOnline: false });
  });

  useOfflineQueueStore.getState().refreshCounts();
  useOfflineQueueStore.getState().refreshLocalIncidents();
}

export type { PendingIncident, SyncStatus };
