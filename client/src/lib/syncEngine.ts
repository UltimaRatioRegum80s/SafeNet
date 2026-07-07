import { 
  getPendingIncidents, 
  updateIncidentStatus,
  incrementRetryCount,
  getAllLocalIncidents,
  purgeOldIncidents,
  getClientInstanceId,
  type PendingIncident 
} from './offlineDb';
import { apiRequest } from './queryClient';

const RETRY_DELAYS = [60000, 300000, 900000];
const MAX_RETRIES = 5;

let isSyncing = false;
let syncListeners: Set<(status: 'idle' | 'syncing' | 'error') => void> = new Set();

export function addSyncListener(listener: (status: 'idle' | 'syncing' | 'error') => void): () => void {
  syncListeners.add(listener);
  return () => syncListeners.delete(listener);
}

function notifySyncStatus(status: 'idle' | 'syncing' | 'error') {
  syncListeners.forEach(listener => listener(status));
}

export async function syncPendingIncidents(): Promise<{ synced: number; failed: number }> {
  if (isSyncing) {
    console.log('[SyncEngine] Already syncing, skipping');
    return { synced: 0, failed: 0 };
  }

  if (!navigator.onLine) {
    console.log('[SyncEngine] Offline, skipping sync');
    return { synced: 0, failed: 0 };
  }

  isSyncing = true;
  notifySyncStatus('syncing');
  
  let synced = 0;
  let failed = 0;

  try {
    const pending = await getPendingIncidents();
    console.log(`[SyncEngine] Found ${pending.length} pending incidents to sync`);

    for (const incident of pending) {
      if (incident.retryCount >= MAX_RETRIES) {
        console.log(`[SyncEngine] Incident ${incident.id} exceeded max retries, marking as error`);
        await updateIncidentStatus(incident.id, 'error', 'Max retries exceeded');
        failed++;
        continue;
      }

      if (incident.lastRetryAt) {
        const delayIndex = Math.min(incident.retryCount, RETRY_DELAYS.length - 1);
        const nextRetryTime = incident.lastRetryAt + RETRY_DELAYS[delayIndex];
        if (Date.now() < nextRetryTime) {
          console.log(`[SyncEngine] Incident ${incident.id} not ready for retry yet`);
          continue;
        }
      }

      try {
        await updateIncidentStatus(incident.id, 'syncing');
        
        const response = await apiRequest('POST', '/api/incidents', {
          type: incident.type,
          title: incident.title,
          description: incident.description,
          latitude: incident.latitude,
          longitude: incident.longitude,
          severity: incident.severity,
          idempotencyKey: incident.idempotencyKey,
          source: 'offline-queue',
        });

        if (response.ok) {
          await updateIncidentStatus(incident.id, 'synced');
          synced++;
          console.log(`[SyncEngine] Incident ${incident.id} synced successfully`);
        } else {
          const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
          
          if (response.status === 409 && errorData.existingId) {
            console.log(`[SyncEngine] Incident ${incident.id} already exists (duplicate), marking synced`);
            await updateIncidentStatus(incident.id, 'synced');
            synced++;
          } else {
            throw new Error(errorData.error || `HTTP ${response.status}`);
          }
        }
      } catch (error: any) {
        console.error(`[SyncEngine] Failed to sync incident ${incident.id}:`, error);
        await incrementRetryCount(incident.id);
        const newRetryCount = incident.retryCount + 1;
        if (newRetryCount >= MAX_RETRIES) {
          await updateIncidentStatus(incident.id, 'error', error.message || 'Max retries exceeded');
        } else {
          await updateIncidentStatus(incident.id, 'pending', error.message);
        }
        failed++;
      }
    }

    await purgeOldIncidents(7);

  } finally {
    isSyncing = false;
    notifySyncStatus(failed > 0 ? 'error' : 'idle');
  }

  return { synced, failed };
}

export function setupOnlineListener(): () => void {
  const handleOnline = () => {
    console.log('[SyncEngine] Back online, triggering sync');
    setTimeout(() => syncPendingIncidents(), 1000);
  };

  const handleVisibilityChange = () => {
    if (!document.hidden && navigator.onLine) {
      console.log('[SyncEngine] App became visible and online, triggering sync');
      syncPendingIncidents();
    }
  };

  window.addEventListener('online', handleOnline);
  document.addEventListener('visibilitychange', handleVisibilityChange);

  if (navigator.onLine) {
    setTimeout(() => syncPendingIncidents(), 2000);
  }

  return () => {
    window.removeEventListener('online', handleOnline);
    document.removeEventListener('visibilitychange', handleVisibilityChange);
  };
}

export async function retryFailedIncident(id: string): Promise<boolean> {
  const incidents = await getAllLocalIncidents();
  const incident = incidents.find(i => i.id === id);
  
  if (!incident) {
    console.error(`[SyncEngine] Incident ${id} not found`);
    return false;
  }

  incident.retryCount = 0;
  incident.lastRetryAt = null;
  await updateIncidentStatus(id, 'pending');
  
  const result = await syncPendingIncidents();
  return result.synced > 0;
}

export function getRetryDelay(retryCount: number): number {
  const delayIndex = Math.min(retryCount, RETRY_DELAYS.length - 1);
  return RETRY_DELAYS[delayIndex];
}

export function formatRetryDelay(ms: number): string {
  if (ms < 60000) return `${Math.round(ms / 1000)}s`;
  return `${Math.round(ms / 60000)}min`;
}
