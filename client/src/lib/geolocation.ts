// client/src/lib/geolocation.ts
export type GeoPoint = { lat: number; lng: number; accuracy?: number };

export class GeolocationError extends Error {
  code?: number;
  constructor(message: string, code?: number) {
    super(message);
    this.name = "GeolocationError";
    this.code = code;
  }
}

export function getCurrentPosition(
  opts: Partial<PositionOptions> = {}
): Promise<GeoPoint> {
  const options: PositionOptions = {
    enableHighAccuracy: true,
    timeout: 8000,
    maximumAge: 0,
    ...opts,
  };

  return new Promise((resolve, reject) => {
    if (!("geolocation" in navigator)) {
      return reject(new GeolocationError("Geolocation not supported"));
    }
    const onSuccess = (pos: GeolocationPosition) => {
      resolve({
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        accuracy: pos.coords.accuracy,
      });
    };
    const onError = (err: GeolocationPositionError) => {
      console.warn("[geo] error", err.code, err.message);
      reject(new GeolocationError(err.message, err.code));
    };
    navigator.geolocation.getCurrentPosition(onSuccess, onError, options);
  });
}