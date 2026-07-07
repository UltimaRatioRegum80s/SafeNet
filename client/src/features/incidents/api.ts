import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { socketService } from "@/lib/socketService";

export function useIncidentComments(incidentId: string, enabled: boolean) {
  const key = ["incidents", incidentId, "comments", "v2"]; // Added v2 to force cache invalidation
  const q = useQuery({
    queryKey: key,
    enabled,
    queryFn: async () => {
      const r = await fetch(`/api/incidents/${incidentId}/comments`);
      const j = await r.json();
      return j.items as any[];
    },
  });

  React.useEffect(() => {
    if (!enabled) return;
    const room = `incident:${incidentId}`;
    socketService.emit("join", room);
    const handler = (p: any) => {
      if (p.incidentId !== incidentId) return;
      q.refetch();
    };
    const onDel = (p: any) => { 
      if (p.incidentId === incidentId) q.refetch(); 
    };
    const unsubscribeNew = socketService.on("incident:comment:new", handler);
    const unsubscribeDel = socketService.on("incident:comment:deleted", onDel);
    return () => {
      socketService.emit("leave", room);
      unsubscribeNew();
      unsubscribeDel();
    };
  }, [incidentId, enabled]);

  return q;
}

export function useAddComment(incidentId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: string) => {
      const r = await fetch(`/api/incidents/${incidentId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body }),
      });
      if (!r.ok) throw new Error("Failed to comment");
      return r.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["incidents", incidentId, "comments", "v2"] }),
  });
}

export function useReviewSummary(
  incidentId: string,
  fetchEnabled: boolean,    // fetch count
  liveEnabled: boolean      // join socket for live updates
) {
  const key = ["incidents", incidentId, "reviews"];
  const q = useQuery({
    queryKey: key,
    enabled: fetchEnabled,
    queryFn: async () => {
      const r = await fetch(`/api/incidents/${incidentId}/reviews`);
      return (await r.json()) as { count: number; reviewedByMe: boolean };
    },
    staleTime: 15_000,
  });

  // Live updates only when panel is open
  React.useEffect(() => {
    if (!liveEnabled) return;
    const room = `incident:${incidentId}`;
    socketService.emit("join", room);
    const handler = (p: any) => { 
      if (p.incidentId === incidentId) q.refetch(); 
    };
    const unsubscribe = socketService.on("incident:review:count", handler);
    return () => {
      socketService.emit("leave", room);
      unsubscribe();
    };
  }, [incidentId, liveEnabled]);

  return q;
}

export function useToggleReview(incidentId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const r = await fetch(`/api/incidents/${incidentId}/reviews/toggle`, { method: "PUT" });
      return (await r.json()) as { reviewed: boolean; count: number };
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["incidents", incidentId, "reviews"] }),
  });
}