export interface LocationData {
  latitude: number;
  longitude: number;
  accuracy: number;
  timestamp: number;
  source?: 'gps-high' | 'gps-network' | 'ip-fallback';
}

export interface GeolocationError {
  code: number;
  message: string;
}

export class GeolocationService {
  private watchId: number | null = null;
  private lastPosition: LocationData | null = null;
  private backgroundTimer: number | null = null;
  private isBackgroundMode: boolean = false;

  async getCurrentPosition(options?: {
    timeout?: number;
    maximumAge?: number;
    enableHighAccuracy?: boolean;
  }): Promise<LocationData> {
    const defaultOptions = {
      timeout: 6000,
      maximumAge: 10000,
      enableHighAccuracy: true,
      ...options
    };

    return new Promise((resolve, reject) => {
      // Try high accuracy first
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const locationData: LocationData = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
            timestamp: position.timestamp,
            source: 'gps-high'
          };
          this.lastPosition = locationData;
          resolve(locationData);
        },
        (error) => {
          // If high accuracy fails, try with lower accuracy
          if (defaultOptions.enableHighAccuracy) {
            console.log('High accuracy failed, trying network-based location...');
            
            navigator.geolocation.getCurrentPosition(
              (position) => {
                const locationData: LocationData = {
                  latitude: position.coords.latitude,
                  longitude: position.coords.longitude,
                  accuracy: position.coords.accuracy,
                  timestamp: position.timestamp,
                  source: 'gps-network'
                };
                this.lastPosition = locationData;
                resolve(locationData);
              },
              (fallbackError) => {
                reject(this.mapGeolocationError(fallbackError));
              },
              {
                ...defaultOptions,
                enableHighAccuracy: false
              }
            );
          } else {
            // Try IP fallback as last resort
            this.getIpFallback()
              .then(ipLocation => {
                this.lastPosition = ipLocation;
                resolve(ipLocation);
              })
              .catch(() => reject(this.mapGeolocationError(error)));
          }
        },
        defaultOptions
      );
    });
  }

  private async getIpFallback(): Promise<LocationData> {
    try {
      const response = await fetch('/api/geo/ip');
      if (!response.ok) throw new Error('IP geolocation unavailable');
      
      const data = await response.json();
      return {
        latitude: data.lat,
        longitude: data.lon,
        accuracy: data.accuracy || 25000, // IP geo is coarse (~10-25km)
        timestamp: Date.now(),
        source: 'ip-fallback'
      };
    } catch (error) {
      // Final fallback to Windhoek, Namibia
      return {
        latitude: -22.5609,
        longitude: 17.0658,
        accuracy: 50000,
        timestamp: Date.now(),
        source: 'ip-fallback'
      };
    }
  }

  startWatchingPosition(
    onUpdate: (position: LocationData) => void,
    onError: (error: GeolocationError) => void,
    options?: {
      enableHighAccuracy?: boolean;
      maximumAge?: number;
      timeout?: number;
      minDistance?: number; // meters
      throttleTime?: number; // milliseconds
      backgroundInterval?: number; // milliseconds for background polling
    }
  ): void {
    const defaultOptions = {
      enableHighAccuracy: true,
      maximumAge: 5000,
      timeout: 6000,
      minDistance: 15,
      throttleTime: 3000,
      backgroundInterval: 180000, // 3 minutes for background tracking
      ...options
    };

    let lastUpdateTime = 0;

    this.watchId = navigator.geolocation.watchPosition(
      (position) => {
        const now = Date.now();
        const locationData: LocationData = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          timestamp: position.timestamp,
          source: defaultOptions.enableHighAccuracy ? 'gps-high' : 'gps-network'
        };

        // Throttle updates
        if (now - lastUpdateTime < defaultOptions.throttleTime) {
          return;
        }

        // Check if position moved enough or accuracy improved
        if (this.lastPosition) {
          const distance = this.calculateDistance(
            this.lastPosition.latitude,
            this.lastPosition.longitude,
            locationData.latitude,
            locationData.longitude
          );

          const accuracyImproved = locationData.accuracy < (this.lastPosition.accuracy - 20);

          if (distance < defaultOptions.minDistance && !accuracyImproved) {
            return;
          }
        }

        this.lastPosition = locationData;
        lastUpdateTime = now;
        onUpdate(locationData);
      },
      (error) => {
        onError(this.mapGeolocationError(error));
      },
      {
        enableHighAccuracy: defaultOptions.enableHighAccuracy,
        maximumAge: defaultOptions.maximumAge,
        timeout: defaultOptions.timeout
      }
    );

    // Set up background tracking with visibility changes
    this.setupBackgroundTracking(onUpdate, onError, defaultOptions);
  }

  private setupBackgroundTracking(
    onUpdate: (position: LocationData) => void,
    onError: (error: GeolocationError) => void,
    options: any
  ): void {
    this.handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        // App went to background, start background polling
        this.startBackgroundPolling(onUpdate, onError, options);
      } else {
        // App came to foreground, stop background polling
        this.stopBackgroundPolling();
      }
    };

    document.addEventListener('visibilitychange', this.handleVisibilityChange);
  }

  private startBackgroundPolling(
    onUpdate: (position: LocationData) => void,
    onError: (error: GeolocationError) => void,
    options: any
  ): void {
    if (this.backgroundTimer) return; // Already running

    this.isBackgroundMode = true;
    this.backgroundTimer = window.setInterval(async () => {
      try {
        const position = await this.getCurrentPosition({
          timeout: 4000,
          enableHighAccuracy: false // Use network-based for battery conservation
        });
        
        // Only update if significant movement or accuracy improvement
        if (this.lastPosition) {
          const distance = this.calculateDistance(
            this.lastPosition.latitude,
            this.lastPosition.longitude,
            position.latitude,
            position.longitude
          );
          
          if (distance >= options.minDistance) {
            onUpdate(position);
          }
        } else {
          onUpdate(position);
        }
      } catch (error: any) {
        // Suppress errors in background mode to avoid interrupting user
        console.log('Background location update failed:', error.message);
      }
    }, options.backgroundInterval);
  }

  private stopBackgroundPolling(): void {
    if (this.backgroundTimer) {
      clearInterval(this.backgroundTimer);
      this.backgroundTimer = null;
    }
    this.isBackgroundMode = false;
  }

  stopWatchingPosition(): void {
    if (this.watchId !== null) {
      navigator.geolocation.clearWatch(this.watchId);
      this.watchId = null;
    }
    
    // Stop background tracking
    this.stopBackgroundPolling();
    if (this.handleVisibilityChange) {
      document.removeEventListener('visibilitychange', this.handleVisibilityChange);
    }
  }

  private handleVisibilityChange: (() => void) | null = null;

  getLastPosition(): LocationData | null {
    return this.lastPosition;
  }

  isLocationSupported(): boolean {
    return 'geolocation' in navigator;
  }

  async checkPermission(): Promise<PermissionState> {
    if ('permissions' in navigator) {
      const permission = await navigator.permissions.query({ name: 'geolocation' });
      return permission.state;
    }
    return 'prompt';
  }

  private mapGeolocationError(error: GeolocationPositionError): GeolocationError {
    switch (error.code) {
      case error.PERMISSION_DENIED:
        return {
          code: error.code,
          message: 'Location access denied. Please enable location services and allow access.'
        };
      case error.POSITION_UNAVAILABLE:
        return {
          code: error.code,
          message: 'Location information unavailable. Please check your device settings.'
        };
      case error.TIMEOUT:
        return {
          code: error.code,
          message: 'Location request timed out. Please try again or use manual pin placement.'
        };
      default:
        return {
          code: error.code,
          message: 'Unknown location error occurred.'
        };
    }
  }

  private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371e3; // Earth's radius in meters
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;

    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  }
}

export const geolocationService = new GeolocationService();