import { useMutation, useQueryClient } from "@tanstack/react-query";
import { postJSON } from "@/lib/http";

export function useCreateIncident() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: any) => {
      return await postJSON("/api/incidents", {
        type: payload.type,
        note: payload.description || payload.title,
        latitude: payload.latitude || payload.lat,
        longitude: payload.longitude || payload.lng,
        ...payload
      });
    },
    onMutate: async (vars: any) => {
      await qc.cancelQueries({ queryKey: ["incidents"] });
      const previous = qc.getQueryData<any[]>(["incidents"]) || [];
      
      // Normalize coordinates to ensure optimistic marker is visible
      const toNum = (v: any) => (v == null ? NaN : Number(v));
      const lat = toNum(vars.lat ?? vars.latitude);
      const lng = toNum(vars.lng ?? vars.longitude);
      
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        // don't seed an optimistic marker with bad coords
        return { previous };
      }
      
      const optimistic = {
        ...vars,
        id: `temp-${Date.now()}`,
        latitude: Number(lat.toFixed(6)),
        longitude: Number(lng.toFixed(6)),
        __optimistic: true,
      };
      qc.setQueryData(["incidents"], [optimistic, ...previous]);
      
      // Also stash for map focus as a backup signal
      localStorage.setItem("nn:last-incident", JSON.stringify({ lat, lng, t: Date.now() }));
      return { previous };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) qc.setQueryData(["incidents"], ctx.previous);
    },
    onSuccess: (created: any) => {
      qc.setQueryData<any[]>(["incidents"], (old = []) => {
        const filtered = old.filter(i => i.id !== created.id && !i.__optimistic);
        return [created, ...filtered];
      });
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["incidents"] });
    },
  });
}