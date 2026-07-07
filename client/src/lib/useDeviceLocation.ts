import { useEffect, useRef } from "react";
import { useLocationStore } from "@/store/locationStore";

export const MAX_STALE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

// Quantize coordinates to prevent GPS jitter from causing query key changes
// 3 decimal places = ~110m precision, good for neighborhood-level queries
export function quantizeCoord(coord: number, decimals = 3): number {
  const factor = Math.pow(10, decimals);
  return Math.round(coord * factor) / factor;
}

export function useDeviceLocation() {
  const setCurrentLocation = useLocationStore(s => s.setCurrentLocation);
  const setLastGoodLocation = useLocationStore(s => s.setLastGoodLocation);
  const setLocationStatus = useLocationStore(s => s.setLocationStatus);
  const setPermission = useLocationStore(s => s.setPermission);
  const watchRef = useRef<number | null>(null);

  useEffect(() => {
    if (!("geolocation" in navigator)) {
      setLocationStatus("unavailable");
      setPermission("unsupported");
      console.log("[DeviceLocation] Geolocation not available");
      return;
    }

    const onSuccess = (pos: GeolocationPosition) => {
      const { latitude, longitude, accuracy } = pos.coords;
      if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
        const now = Date.now();
        const locationData = {
          latitude,
          longitude,
          accuracy: accuracy || 100,
          timestamp: now,
          source: accuracy && accuracy <= 50 ? 'gps-high' as const : 'gps-network' as const,
        };
        
        setCurrentLocation(locationData);
        setLastGoodLocation({ lat: latitude, lng: longitude, timestamp: now });
        setLocationStatus("ok");
        setPermission("granted");
        console.log("[DeviceLocation] Location updated:", { lat: latitude, lng: longitude, accuracy });
      } else {
        console.warn("[DeviceLocation] Invalid coordinates received");
        setLocationStatus("unavailable");
      }
    };

    const onError = (err: GeolocationPositionError) => {
      console.warn("[DeviceLocation] Error:", err.code, err.message);
      if (err.code === err.PERMISSION_DENIED) {
        setLocationStatus("denied");
        setPermission("denied");
      } else {
        setLocationStatus("unavailable");
      }
    };

    console.log("[DeviceLocation] Starting watchPosition");
    watchRef.current = navigator.geolocation.watchPosition(onSuccess, onError, {
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 5000,
    });

    return () => {
      if (watchRef.current != null) {
        console.log("[DeviceLocation] Clearing watchPosition");
        navigator.geolocation.clearWatch(watchRef.current);
      }
    };
  }, [setCurrentLocation, setLastGoodLocation, setLocationStatus, setPermission]);
}

export function pickQueryLocation(store: {
  currentLocation?: { latitude: number; longitude: number; timestamp?: number } | null;
  lastGoodLocation?: { lat: number; lng: number; timestamp: number } | null;
}): { lat: number; lng: number } | null {
  const now = Date.now();
  
  // Check current location first
  if (store.currentLocation) {
    const timestamp = store.currentLocation.timestamp || now;
    if (now - timestamp <= MAX_STALE_MS) {
      return { 
        lat: store.currentLocation.latitude, 
        lng: store.currentLocation.longitude 
      };
    }
  }
  
  // Fall back to last good location
  if (store.lastGoodLocation && now - store.lastGoodLocation.timestamp <= MAX_STALE_MS) {
    return store.lastGoodLocation;
  }
  
  return null;
}

export function isLocationFresh(timestamp: number | undefined): boolean {
  if (!timestamp) return false;
  return Date.now() - timestamp <= MAX_STALE_MS;
}
