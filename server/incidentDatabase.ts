import { nanoid } from 'nanoid';

export interface IncidentRecord {
  id: string;
  type: string;
  description: string;
  lat: number;
  lng: number;
  accuracy_m: number;
  created_at: number;
  reporter_id: string | null;
}

export interface CreateIncidentData {
  type: string;
  description: string;
  lat: number;
  lng: number;
  accuracy_m: number;
  reporter_id?: string | null;
}

// Stub — incidents are stored in PostgreSQL via storage.ts.
// This object is kept for legacy import compatibility; callers should use storage instead.
export const incidentDB = {
  createIncident(data: CreateIncidentData): IncidentRecord {
    return {
      id: nanoid(),
      type: data.type,
      description: data.description,
      lat: data.lat,
      lng: data.lng,
      accuracy_m: data.accuracy_m,
      created_at: Date.now(),
      reporter_id: data.reporter_id || null,
    };
  },
  getRecentIncidents(_hoursBack: number = 24): IncidentRecord[] {
    return [];
  },
};

// Validation functions
export function validateIncidentData(data: any): { valid: boolean; error?: string } {
  if (!data.lat || !data.lng || data.accuracy_m === undefined) {
    return { valid: false, error: 'Required fields: lat, lng, accuracy_m' };
  }

  if (data.accuracy_m > 100) {
    return { valid: false, error: 'Location accuracy is too low (>100m)' };
  }

  // Basic Namibia bounds check (rough approximation)
  if (data.lat < -29 || data.lat > -16 || data.lng < 11 || data.lng > 25) {
    return { valid: false, error: 'Location outside Namibia bounds' };
  }

  return { valid: true };
}

// Enhanced rate limiting with memory cleanup and configurable parameters
const reporterLimits = new Map<string, number>();
const RATE_LIMIT_WINDOW = (Number(process.env.RATE_LIMITS_INCIDENT_WINDOW_SEC) || 3) * 1000;
const RATE_LIMIT_ANON_WINDOW = (Number(process.env.RATE_LIMITS_INCIDENT_ANON_WINDOW_SEC) || 3) * 1000;
const CLEANUP_INTERVAL = 300000; // 5 minutes

// Cleanup old entries periodically to prevent memory leaks
setInterval(() => {
  const now = Date.now();
  for (const [reporterId, timestamp] of Array.from(reporterLimits.entries())) {
    if (now - timestamp > RATE_LIMIT_WINDOW * 3) {
      reporterLimits.delete(reporterId);
    }
  }
}, CLEANUP_INTERVAL);

export function checkRateLimit(reporterId: string, isAnonymous: boolean = false): boolean {
  const now = Date.now();
  const lastReport = reporterLimits.get(reporterId);
  const windowMs = isAnonymous ? RATE_LIMIT_ANON_WINDOW : RATE_LIMIT_WINDOW;

  if (lastReport && (now - lastReport) < windowMs) {
    return false;
  }

  reporterLimits.set(reporterId, now);
  return true;
}
