export type Incident = {
  id: string;
  title?: string;
  type: string;
  description?: string;
  createdAt: string;
  latitude: string | number;
  longitude: string | number;
  lat?: number;
  lng?: number;
  severity?: string;
  status?: string;
  // Add other properties as needed
};

type Paginated<T> = { 
  incidents?: T[];
  items?: T[]; 
  total?: number; 
  nextCursor?: string 
};

/** Both `/api/incidents?bbox=...` (array) and `/api/incidents` (paginated) → Incident[] */
export async function fetchIncidentsAny(url: string): Promise<Incident[]> {
  const res = await fetch(url, { credentials: "include" });
  if (!res.ok) throw new Error(`Failed: ${res.status}`);
  const data = await res.json();
  
  // Handle direct array response (bbox queries)
  if (Array.isArray(data)) return data as Incident[];
  
  // Handle paginated response (regular queries)
  if (data && Array.isArray(data.incidents)) {
    return data.incidents as Incident[];
  }
  if (data && Array.isArray(data.items)) {
    return data.items as Incident[];
  }
  
  return [];
}

export function dedupeById(items: Incident[]): Incident[] {
  const seen = new Set<string>();
  const out: Incident[] = [];
  for (const i of items) {
    if (!seen.has(i.id)) {
      seen.add(i.id);
      out.push(i);
    }
  }
  return out;
}

export function normalizeIncidentCoords(incident: Incident): { lat: number; lng: number } | null {
  const lat = Number(incident.latitude || incident.lat || 0);
  const lng = Number(incident.longitude || incident.lng || 0);
  
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  
  return { lat, lng };
}