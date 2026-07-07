import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { LocationData, GeolocationError } from '../lib/geolocationService';

export type PermissionStateLike = 'granted' | 'denied' | 'prompt' | 'unsupported';
export type LocationStatus = 'ok' | 'stale' | 'denied' | 'unavailable' | 'pending';

interface LocationState {
  // Current location data
  currentLocation: LocationData | null;
  
  // Last good location with timestamp (for stale fallback)
  lastGoodLocation: { lat: number; lng: number; timestamp: number } | null;
  
  // Location status state machine
  locationStatus: LocationStatus;
  
  // Permission status
  permission: PermissionStateLike;
  
  // Tracking state
  isWatching: boolean;
  isBackgroundMode: boolean;
  
  // Error handling
  error: GeolocationError | null;
  
  // Location history (last 5 positions for analysis)
  locationHistory: LocationData[];
  
  // Refined coordinates for user-selected locations
  refinedCoords: { lat: number; lng: number } | null;
  
  // Actions
  setCurrentLocation: (location: LocationData) => void;
  setLastGoodLocation: (location: { lat: number; lng: number; timestamp: number }) => void;
  setLocationStatus: (status: LocationStatus) => void;
  setPermission: (permission: PermissionStateLike) => void;
  setWatching: (watching: boolean) => void;
  setBackgroundMode: (backgroundMode: boolean) => void;
  setError: (error: GeolocationError | null) => void;
  addToHistory: (location: LocationData) => void;
  clearError: () => void;
  reset: () => void;
  setRefinedCoords: (coords: { lat: number; lng: number } | null) => void;
  
  // Computed getters
  getLastKnownLocation: () => LocationData | null;
  getLocationSource: () => string;
  getAccuracyStatus: () => 'high' | 'medium' | 'low';
}

export const useLocationStore = create<LocationState>()(
  persist(
    (set, get) => ({
      // Initial state
      currentLocation: null,
      lastGoodLocation: null,
      locationStatus: 'pending' as LocationStatus,
      permission: 'prompt',
      isWatching: false,
      isBackgroundMode: false,
      error: null,
      locationHistory: [],
      refinedCoords: null,

      // Actions
      setCurrentLocation: (location: LocationData) => {
        set((state) => {
          // Add to history and keep only last 5
          const newHistory = [location, ...state.locationHistory].slice(0, 5);
          return {
            currentLocation: location,
            locationHistory: newHistory,
            error: null // Clear error on successful location update
          };
        });
      },

      setLastGoodLocation: (location: { lat: number; lng: number; timestamp: number }) => {
        set({ lastGoodLocation: location });
      },

      setLocationStatus: (status: LocationStatus) => {
        set({ locationStatus: status });
      },

      setPermission: (permission: PermissionStateLike) => set({ permission }),

      setWatching: (watching: boolean) => set({ isWatching: watching }),

      setBackgroundMode: (backgroundMode: boolean) => set({ isBackgroundMode: backgroundMode }),

      setError: (error: GeolocationError | null) => set({ error }),

      addToHistory: (location: LocationData) => {
        set((state) => ({
          locationHistory: [location, ...state.locationHistory].slice(0, 5)
        }));
      },

      clearError: () => set({ error: null }),

      setRefinedCoords: (coords: { lat: number; lng: number } | null) => set({ refinedCoords: coords }),

      reset: () => set({
        currentLocation: null,
        lastGoodLocation: null,
        locationStatus: 'pending' as LocationStatus,
        permission: 'prompt',
        isWatching: false,
        isBackgroundMode: false,
        error: null,
        locationHistory: [],
        refinedCoords: null
      }),

      // Computed getters
      getLastKnownLocation: () => {
        const state = get();
        return state.currentLocation || state.locationHistory[0] || null;
      },

      getLocationSource: () => {
        const state = get();
        const location = state.currentLocation;
        if (!location?.source) return 'unknown';
        
        switch (location.source) {
          case 'gps-high': return 'High-accuracy GPS';
          case 'gps-network': return 'Network-based GPS';
          case 'ip-fallback': return 'IP Geolocation';
          default: return 'Unknown';
        }
      },

      getAccuracyStatus: () => {
        const state = get();
        const location = state.currentLocation;
        if (!location) return 'low';
        
        if (location.accuracy <= 50) return 'high';
        if (location.accuracy <= 200) return 'medium';
        return 'low';
      }
    }),
    {
      name: 'nabornet-location-store',
      // Only persist essential data, not transient state
      partialize: (state) => ({
        currentLocation: state.currentLocation,
        lastGoodLocation: state.lastGoodLocation,
        permission: state.permission,
        locationHistory: state.locationHistory
      })
    }
  )
);

// Helper hook for location access
export const useLocationData = () => {
  const store = useLocationStore();
  
  return {
    location: store.currentLocation,
    lastGoodLocation: store.lastGoodLocation,
    locationStatus: store.locationStatus,
    permission: store.permission,
    isWatching: store.isWatching,
    isBackground: store.isBackgroundMode,
    error: store.error,
    history: store.locationHistory,
    
    // Computed values
    lastKnown: store.getLastKnownLocation(),
    source: store.getLocationSource(),
    accuracy: store.getAccuracyStatus(),
    
    // Quick status checks
    hasLocation: !!store.currentLocation,
    isPermissionGranted: store.permission === 'granted',
    hasHighAccuracy: store.currentLocation?.accuracy ? store.currentLocation.accuracy <= 50 : false,
    
    // Refined coordinates
    refinedCoords: store.refinedCoords
  };
};