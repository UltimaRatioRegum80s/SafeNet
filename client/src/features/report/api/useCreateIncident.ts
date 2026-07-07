// client/src/features/report/api/useCreateIncident.ts
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { Severity } from "@/features/report/incidentTypes";

export type CreateIncidentDTO = {
  type: string;
  severity: Severity;
  latitude: string;  // Changed to string to match backend decimal type
  longitude: string; // Changed to string to match backend decimal type
  description?: string;
};

async function postIncident(dto: CreateIncidentDTO) {
  const res = await fetch("/api/incidents", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(dto),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `Failed to create incident (${res.status})`);
  }
  return (await res.json()) as { id: string };
}

export function useCreateIncident() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: postIncident,
    onSuccess: () => {
      console.debug("[incident] created -> invalidating incidents");
      // refresh any lists/feeds if present - using exact key match for invalidation
      qc.invalidateQueries({ queryKey: ["incidents"] }).catch(() => {});
    },
  });
}