import { useMemo } from "react";
import { useAuthStore } from "@/store/auth";
import { getCityCoordinates } from "@/lib/locationCoordinates";

export interface CityCoords {
  lat: number;
  lng: number;
  cityName: string;
}

export function useCityFallbackCoords(): CityCoords | null {
  const user = useAuthStore(s => s.user);

  return useMemo(() => {
    if (!user?.city) return null;
    const coords = getCityCoordinates(user.city);
    if (!coords) return null;
    return { lat: coords[0], lng: coords[1], cityName: user.city };
  }, [user?.city]);
}
