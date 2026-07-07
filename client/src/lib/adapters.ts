import { Severity, toSeverity } from "@/lib/severity";

export type IncidentUI = {
  id: string;
  title: string;
  description?: string;
  severity: Severity;
  createdAt: string;        // ISO
  lat: number;
  lng: number;
};

// Example adapter from your current API/Socket payload
export function adaptIncident(row: any): IncidentUI {
  return {
    id: String(row.id ?? row._id),
    title: row.title ?? row.name ?? "Incident",
    description: row.description ?? row.summary ?? "",
    severity: toSeverity(row.severity ?? row.priority ?? row.level),
    createdAt: row.created_at ?? row.createdAt ?? new Date().toISOString(),
    lat: row.position?.lat ?? row.lat ?? parseFloat(row.latitude ?? 0),
    lng: row.position?.lng ?? row.lng ?? parseFloat(row.longitude ?? 0),
  };
}