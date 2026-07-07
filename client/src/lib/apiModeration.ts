// API utilities for moderation and abuse reporting

export async function reportIncidentAbuse(
  id: string, 
  body: { reason: "spam" | "harassment" | "misinfo" | "other"; note?: string }
) {
  const res = await fetch(`/api/incidents/${id}/abuse-report`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(body),
  });
  
  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(errorText || `HTTP ${res.status}`);
  }
  
  return res.json();
}

export async function getModerationQueue() {
  const res = await fetch("/api/moderation/queue", {
    method: "GET",
    credentials: "include",
  });
  
  if (!res.ok) {
    throw new Error(`Failed to fetch moderation queue: ${res.status}`);
  }
  
  return res.json();
}

export async function moderateIncident(
  id: string, 
  action: "approve" | "reject"
) {
  const res = await fetch(`/api/moderation/incidents/${id}/action`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ action }),
  });
  
  if (!res.ok) {
    throw new Error(`Moderation action failed: ${res.status}`);
  }
  
  return res.json();
}