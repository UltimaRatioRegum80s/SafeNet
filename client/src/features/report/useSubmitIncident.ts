import { getAccuratePosition } from "./useMobileLocation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { RoutePaths } from "@/router/routePaths";

type Values = {
  title: string;
  type: string;
  description: string;
  severity: string;
  category: string;
  // Frontend may have either {lat,lng} or {latitude,longitude}
  lat?: number | string;
  lng?: number | string;
  latitude?: number | string;
  longitude?: number | string;
  isAnonymous?: boolean;
  photos?: string[];
};

export function useSubmitIncident() {
  const qc = useQueryClient();
  const [, setLocation] = useLocation();

  const mutation = useMutation({
    mutationFn: async (payload: any) => {
      const r = await fetch("/api/incidents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!r.ok) throw new Error("Failed to create incident");
      return r.json();
    },
    onMutate: async () => {
      await qc.cancelQueries({ queryKey: ["incidents"] });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["incidents"] });
    },
  });

  return async (values: Values) => {
    // Normalize coord names & types (frontend → schema)
    const lat = values.lat ?? values.latitude;
    const lng = values.lng ?? values.longitude;

    let numLat = Number(lat);
    let numLng = Number(lng);

    if (!Number.isFinite(numLat) || !Number.isFinite(numLng)) {
      try {
        const p = await getAccuratePosition();
        numLat = p.lat;
        numLng = p.lng;
      } catch {
        // allow submit without focus, but ideally show a toast
      }
    }

    // Stash for fallback focus
    const last = { lat: numLat, lng: numLng, t: Date.now(), type: values.type };
    localStorage.setItem("nn:last-incident", JSON.stringify(last));

    // Submit with schema field names
    await mutation.mutateAsync({
      ...values,
      latitude: Number(numLat.toFixed(6)),
      longitude: Number(numLng.toFixed(6)),
    });

    // Redirect with focus params (Wouter)
    const sp = new URLSearchParams({
      lat: String(numLat),
      lng: String(numLng),
      z: "17",
      highlight: "1",
    });
    setLocation(`${RoutePaths.Map}?${sp.toString()}`);
  };
}