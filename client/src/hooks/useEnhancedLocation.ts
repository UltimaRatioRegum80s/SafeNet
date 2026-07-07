import { useEffect, useCallback, useRef } from 'react';
import { useLocationStore, type PermissionStateLike } from '../store/locationStore';
import { geolocationService, type LocationData, type GeolocationError } from '../lib/geolocationService';

interface UseEnhancedLocationOptions {
  // Whether to automatically start watching position on mount
  autoStart?: boolean;
  
  // Watch options
  enableHighAccuracy?: boolean;
  minDistance?: number; // meters
  throttleTime?: number; // milliseconds
  backgroundInterval?: number; // milliseconds for background polling
  
  // Whether to request permission automatically
  requestPermission?: boolean;
}

interface UseEnhancedLocationReturn {
  // Current state
  location: LocationData | null;
  permission: PermissionStateLike;
  isWatching: boolean;
  isBackground: boolean;
  error: GeolocationError | null;
  
  // Actions
  getCurrentPosition: () => Promise<LocationData>;
  startWatching: () => void;
  stopWatching: () => void;
  requestPermission: () => Promise<PermissionStateLike>;
  clearError: () => void;
  
  // Status helpers
  hasLocation: boolean;
  isPermissionGranted: boolean;
  hasHighAccuracy: boolean;
  locationSource: string;
  accuracyStatus: 'high' | 'medium' | 'low';
  
  // Location refinement
  refinedCoords: { lat: number; lng: number } | null;
  setRefinedCoords: (coords: { lat: number; lng: number } | null) => void;
  coords: { lat: number; lng: number } | null;
}

export function useEnhancedLocation(options: UseEnhancedLocationOptions = {}): UseEnhancedLocationReturn {
  const {
    autoStart = false,
    enableHighAccuracy = true,
    minDistance = 15,
    throttleTime = 3000,
    backgroundInterval = 180000,
    requestPermission = false
  } = options;

  const watchingRef = useRef(false);
  
  // Zustand store actions and state
  const {
    currentLocation,
    permission,
    isWatching,
    isBackgroundMode,
    error,
    setCurrentLocation,
    setPermission,
    setWatching,
    setBackgroundMode,
    setError,
    clearError: clearStoreError,
    getLastKnownLocation,
    getLocationSource,
    getAccuracyStatus
  } = useLocationStore();

  // Initialize permission status
  useEffect(() => {
    const checkPermission = async () => {
      try {
        if (!geolocationService.isLocationSupported()) {
          setPermission('unsupported');
          return;
        }
        
        const permissionState = await geolocationService.checkPermission();
        setPermission(permissionState);
        
        // Auto-request permission if configured
        if (requestPermission && permissionState === 'prompt') {
          await requestPermissionHandler();
        }
      } catch (error) {
        console.warn('Permission check failed:', error);
        setPermission('prompt');
      }
    };
    
    checkPermission();
  }, [requestPermission, setPermission]);

  // Auto-start watching if configured and permission granted
  useEffect(() => {
    if (autoStart && permission === 'granted' && !isWatching) {
      startWatching();
    }
  }, [autoStart, permission, isWatching]);

  const getCurrentPosition = useCallback(async (): Promise<LocationData> => {
    try {
      setError(null);
      const location = await geolocationService.getCurrentPosition({
        enableHighAccuracy,
        timeout: 6000,
        maximumAge: 10000
      });
      
      setCurrentLocation(location);
      return location;
    } catch (error: any) {
      const geoError: GeolocationError = {
        code: error.code || 0,
        message: error.message || 'Failed to get current position'
      };
      setError(geoError);
      throw geoError;
    }
  }, [enableHighAccuracy, setCurrentLocation, setError]);

  const startWatching = useCallback(() => {
    if (watchingRef.current || permission !== 'granted') {
      return;
    }

    watchingRef.current = true;
    setWatching(true);
    setError(null);

    geolocationService.startWatchingPosition(
      (location: LocationData) => {
        setCurrentLocation(location);
        setBackgroundMode(document.visibilityState === 'hidden');
      },
      (error: GeolocationError) => {
        setError(error);
        console.warn('Location watch error:', error);
      },
      {
        enableHighAccuracy,
        minDistance,
        throttleTime,
        backgroundInterval
      }
    );
  }, [
    permission,
    enableHighAccuracy,
    minDistance,
    throttleTime,
    backgroundInterval,
    setCurrentLocation,
    setWatching,
    setBackgroundMode,
    setError
  ]);

  const stopWatching = useCallback(() => {
    if (!watchingRef.current) return;
    
    watchingRef.current = false;
    setWatching(false);
    setBackgroundMode(false);
    geolocationService.stopWatchingPosition();
  }, [setWatching, setBackgroundMode]);

  const requestPermissionHandler = useCallback(async (): Promise<PermissionStateLike> => {
    try {
      // Try to get current position to trigger permission request
      await geolocationService.getCurrentPosition({
        enableHighAccuracy: false,
        timeout: 5000
      });
      
      const newPermission = await geolocationService.checkPermission();
      setPermission(newPermission);
      return newPermission;
    } catch (error: any) {
      // Check permission status even if position failed
      const permissionState = await geolocationService.checkPermission();
      setPermission(permissionState);
      
      if (permissionState === 'denied') {
        setError({
          code: 1,
          message: 'Location access denied. Please enable location services in your browser settings.'
        });
      }
      
      return permissionState;
    }
  }, [setPermission, setError]);

  const clearError = useCallback(() => {
    clearStoreError();
  }, [clearStoreError]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (watchingRef.current) {
        stopWatching();
      }
    };
  }, [stopWatching]);

  const { refinedCoords, setRefinedCoords } = useLocationStore();
  
  return {
    // Current state
    location: currentLocation,
    permission,
    isWatching,
    isBackground: isBackgroundMode,
    error,
    
    // Actions
    getCurrentPosition,
    startWatching,
    stopWatching,
    requestPermission: requestPermissionHandler,
    clearError,
    
    // Status helpers
    hasLocation: !!currentLocation,
    isPermissionGranted: permission === 'granted',
    hasHighAccuracy: currentLocation?.accuracy ? currentLocation.accuracy <= 50 : false,
    locationSource: getLocationSource(),
    accuracyStatus: getAccuracyStatus(),
    
    // Location refinement
    refinedCoords,
    setRefinedCoords,
    coords: currentLocation ? { lat: currentLocation.latitude, lng: currentLocation.longitude } : null
  };
}

// Convenience hook for components that just need location data
export function useCurrentLocation() {
  const { location, hasLocation, isPermissionGranted, hasHighAccuracy } = useEnhancedLocation({
    autoStart: false,
    requestPermission: false
  });
  
  return {
    location,
    hasLocation,
    isPermissionGranted,
    hasHighAccuracy,
    coordinates: location ? { lat: location.latitude, lng: location.longitude } : null
  };
}

// Hook for guard patrol features that need continuous tracking
export function usePatrolTracking() {
  return useEnhancedLocation({
    autoStart: true,
    requestPermission: true,
    enableHighAccuracy: true,
    minDistance: 10, // More sensitive for patrol routes
    throttleTime: 2000, // More frequent updates
    backgroundInterval: 60000 // 1 minute background polling for patrols
  });
}