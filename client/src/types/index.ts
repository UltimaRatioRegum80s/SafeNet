export type UserRole = 'resident' | 'moderator' | 'admin' | 'guard' | 'supervisor' | 'client';

export interface User {
  uid: string;
  tenantId: string;
  roles: UserRole[];
  displayName: string;
  email: string | null;
  phone?: string;
  status: 'active' | 'inactive';
  createdAt: Date;
  updatedAt: Date;
}

export interface Tenant {
  id: string;
  name: string;
  billingPlan: 'basic' | 'professional' | 'enterprise';
  createdAt: Date;
  updatedAt: Date;
}

export interface Site {
  id: string;
  tenantId: string;
  name: string;
  geofence: {
    type: 'circle' | 'polygon';
    center?: { lat: number; lng: number };
    radius?: number;
    coordinates?: { lat: number; lng: number }[];
  };
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
  updatedBy: string;
}

export interface PatrolPoint {
  id: string;
  siteId: string;
  label: string;
  location: { lat: number; lng: number };
  radiusM: number;
  qrCode?: string;
  nfcTagId?: string;
  order: number;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
  updatedBy: string;
}

export interface Route {
  id: string;
  siteId: string;
  name: string;
  pointIds: string[];
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
  updatedBy: string;
}

export interface Shift {
  id: string;
  siteId: string;
  guardId: string;
  startAt: Date;
  endAt: Date;
  status: 'scheduled' | 'active' | 'completed' | 'cancelled';
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
  updatedBy: string;
}

export interface CheckIn {
  id: string;
  siteId: string;
  patrolPointId: string;
  guardId: string;
  timestamp: Date;
  location: { lat: number; lng: number };
  batteryPct: number;
  photoUrl?: string;
  method: 'gps' | 'qr' | 'nfc';
  createdAt: Date;
  createdBy: string;
}

export interface Incident {
  id: string;
  siteId: string;
  category: 'suspicious' | 'break-in' | 'medical' | 'fire' | 'maintenance' | 'other';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  photos: string[];
  location?: { lat: number; lng: number };
  status: 'open' | 'in-progress' | 'resolved' | 'closed';
  assignedTo?: string;
  resolvedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
  updatedBy: string;
}

export interface Alert {
  id: string;
  siteId: string;
  guardId: string;
  type: 'SOS' | 'panic' | 'emergency';
  location: { lat: number; lng: number };
  handledBy?: string;
  handledAt?: Date;
  createdAt: Date;
  createdBy: string;
}

export interface DashboardData {
  activeGuards: number;
  openIncidents: number;
  compliance: number;
  recentCheckins: CheckIn[];
  recentIncidents: Incident[];
  guardLocations: Array<{
    guardId: string;
    guardName: string;
    location: { lat: number; lng: number };
    lastUpdate: Date;
  }>;
}
