import Database from 'better-sqlite3';
import { nanoid } from 'nanoid';
import path from 'path';
import fs from 'fs';

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

class IncidentDatabase {
  private db: Database.Database;

  constructor() {
    // Ensure data directory exists
    const dataDir = path.join(process.cwd(), 'data');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    const dbPath = path.join(dataDir, 'incidents.db');
    this.db = new Database(dbPath);
    
    // Create table if it doesn't exist
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS incidents (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        description TEXT NOT NULL,
        lat REAL NOT NULL,
        lng REAL NOT NULL,
        accuracy_m INTEGER NOT NULL,
        created_at INTEGER NOT NULL,
        reporter_id TEXT
      )
    `);

    // Create index for faster queries
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_incidents_created_at ON incidents(created_at);
    `);
  }

  createIncident(data: CreateIncidentData): IncidentRecord {
    const incident: IncidentRecord = {
      id: nanoid(),
      type: data.type,
      description: data.description,
      lat: data.lat,
      lng: data.lng,
      accuracy_m: data.accuracy_m,
      created_at: Date.now(),
      reporter_id: data.reporter_id || null
    };

    const stmt = this.db.prepare(`
      INSERT INTO incidents (id, type, description, lat, lng, accuracy_m, created_at, reporter_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      incident.id,
      incident.type,
      incident.description,
      incident.lat,
      incident.lng,
      incident.accuracy_m,
      incident.created_at,
      incident.reporter_id
    );

    return incident;
  }

  getIncidentsSince(sinceMs: number): IncidentRecord[] {
    const stmt = this.db.prepare(`
      SELECT * FROM incidents 
      WHERE created_at >= ? 
      ORDER BY created_at DESC
    `);

    return stmt.all(sinceMs) as IncidentRecord[];
  }

  getRecentIncidents(hoursBack: number = 24): IncidentRecord[] {
    const sinceMs = Date.now() - (hoursBack * 60 * 60 * 1000);
    return this.getIncidentsSince(sinceMs);
  }

  close() {
    this.db.close();
  }
}

// Singleton instance
export const incidentDB = new IncidentDatabase();

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
const RATE_LIMIT_WINDOW = (Number(process.env.RATE_LIMITS_INCIDENT_WINDOW_SEC) || 3) * 1000; // Default 3 seconds
const RATE_LIMIT_ANON_WINDOW = (Number(process.env.RATE_LIMITS_INCIDENT_ANON_WINDOW_SEC) || 3) * 1000; // Default 3 seconds
const CLEANUP_INTERVAL = 300000; // 5 minutes

// Cleanup old entries periodically to prevent memory leaks
setInterval(() => {
  const now = Date.now();
  const entries = Array.from(reporterLimits.entries());
  for (const [reporterId, timestamp] of entries) {
    if (now - timestamp > RATE_LIMIT_WINDOW * 3) { // Keep for 3x the window
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