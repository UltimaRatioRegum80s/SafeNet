import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { v4 as uuidv4 } from 'uuid';

export type SyncStatus = 'pending' | 'syncing' | 'synced' | 'error';

export interface PendingIncident {
  id: string;
  idempotencyKey: string;
  type: string;
  title: string;
  description: string;
  latitude: number;
  longitude: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  createdAt: number;
  syncStatus: SyncStatus;
  retryCount: number;
  lastRetryAt: number | null;
  errorMessage: string | null;
}

interface NaborNetDB extends DBSchema {
  pendingIncidents: {
    key: string;
    value: PendingIncident;
    indexes: {
      'by-status': SyncStatus;
      'by-createdAt': number;
    };
  };
  appMeta: {
    key: string;
    value: { key: string; value: any };
  };
}

const DB_NAME = 'nabornet-offline';
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase<NaborNetDB>> | null = null;

function getClientInstanceId(): string {
  let clientId = localStorage.getItem('nabornet-clientInstanceId');
  if (!clientId) {
    clientId = uuidv4();
    localStorage.setItem('nabornet-clientInstanceId', clientId);
  }
  return clientId;
}

export function getDB(): Promise<IDBPDatabase<NaborNetDB>> {
  if (!dbPromise) {
    dbPromise = openDB<NaborNetDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('pendingIncidents')) {
          const incidentStore = db.createObjectStore('pendingIncidents', { keyPath: 'id' });
          incidentStore.createIndex('by-status', 'syncStatus');
          incidentStore.createIndex('by-createdAt', 'createdAt');
        }
        if (!db.objectStoreNames.contains('appMeta')) {
          db.createObjectStore('appMeta', { keyPath: 'key' });
        }
      },
    });
  }
  return dbPromise;
}

export async function enqueueIncident(incident: Omit<PendingIncident, 'id' | 'idempotencyKey' | 'syncStatus' | 'retryCount' | 'lastRetryAt' | 'errorMessage'>): Promise<PendingIncident> {
  const db = await getDB();
  const clientId = getClientInstanceId();
  
  const pendingIncident: PendingIncident = {
    ...incident,
    id: uuidv4(),
    idempotencyKey: `${clientId}-${uuidv4()}`,
    syncStatus: 'pending',
    retryCount: 0,
    lastRetryAt: null,
    errorMessage: null,
  };
  
  await db.put('pendingIncidents', pendingIncident);
  console.log('[OfflineDB] Incident enqueued:', pendingIncident.id);
  return pendingIncident;
}

export async function getPendingIncidents(): Promise<PendingIncident[]> {
  const db = await getDB();
  return db.getAllFromIndex('pendingIncidents', 'by-status', 'pending');
}

export async function getAllLocalIncidents(): Promise<PendingIncident[]> {
  const db = await getDB();
  return db.getAll('pendingIncidents');
}

export async function getIncidentById(id: string): Promise<PendingIncident | undefined> {
  const db = await getDB();
  return db.get('pendingIncidents', id);
}

export async function updateIncidentStatus(id: string, status: SyncStatus, errorMessage?: string): Promise<void> {
  const db = await getDB();
  const incident = await db.get('pendingIncidents', id);
  if (incident) {
    incident.syncStatus = status;
    if (status === 'synced') {
      incident.errorMessage = null;
    } else if (status === 'error') {
      incident.errorMessage = errorMessage || 'Sync failed';
    }
    await db.put('pendingIncidents', incident);
    console.log(`[OfflineDB] Incident ${id} status updated to ${status}`);
  }
}

export async function incrementRetryCount(id: string): Promise<void> {
  const db = await getDB();
  const incident = await db.get('pendingIncidents', id);
  if (incident) {
    incident.retryCount += 1;
    incident.lastRetryAt = Date.now();
    await db.put('pendingIncidents', incident);
    console.log(`[OfflineDB] Incident ${id} retry count: ${incident.retryCount}`);
  }
}

export async function markForRetry(id: string): Promise<void> {
  const db = await getDB();
  const incident = await db.get('pendingIncidents', id);
  if (incident) {
    incident.syncStatus = 'pending';
    await db.put('pendingIncidents', incident);
    console.log(`[OfflineDB] Incident ${id} marked for retry`);
  }
}

export async function removeIncident(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('pendingIncidents', id);
  console.log(`[OfflineDB] Incident ${id} removed`);
}

export async function purgeOldIncidents(maxAgeDays: number = 7): Promise<number> {
  const db = await getDB();
  const cutoffTime = Date.now() - (maxAgeDays * 24 * 60 * 60 * 1000);
  const all = await db.getAll('pendingIncidents');
  
  let purgedCount = 0;
  for (const incident of all) {
    if (incident.createdAt < cutoffTime) {
      await db.delete('pendingIncidents', incident.id);
      purgedCount++;
    }
  }
  
  if (purgedCount > 0) {
    console.log(`[OfflineDB] Purged ${purgedCount} old incidents`);
  }
  return purgedCount;
}

export async function clearAllOfflineData(): Promise<void> {
  const db = await getDB();
  const tx = db.transaction(['pendingIncidents', 'appMeta'], 'readwrite');
  await Promise.all([
    tx.objectStore('pendingIncidents').clear(),
    tx.objectStore('appMeta').clear(),
    tx.done,
  ]);
  console.log('[OfflineDB] All offline data cleared');
}

export async function getPendingCount(): Promise<number> {
  const db = await getDB();
  return db.countFromIndex('pendingIncidents', 'by-status', 'pending');
}

export async function getErrorCount(): Promise<number> {
  const db = await getDB();
  return db.countFromIndex('pendingIncidents', 'by-status', 'error');
}

export function reduceLocationPrecision(lat: number, lng: number): { lat: number; lng: number; label: string } {
  const reducedLat = Math.round(lat * 100) / 100;
  const reducedLng = Math.round(lng * 100) / 100;
  return {
    lat: reducedLat,
    lng: reducedLng,
    label: 'Approx. location'
  };
}

export { getClientInstanceId };
