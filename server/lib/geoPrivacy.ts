/**
 * Coordinate fuzzing for privacy protection.
 *
 * Incident pins are fuzzed by ~60–150 m before being served to non-admin clients.
 * Fuzzing is deterministic per incident ID so the same incident always lands on
 * the same fuzzed pin (no jitter on refresh), but the offset is unpredictable to
 * an outside observer.
 *
 * Radius queries always use the raw DB coordinates, so accuracy is unaffected.
 *
 * Disable for testing: set env var FUZZ_COORDS=false
 */

const FUZZ_ENABLED = process.env.FUZZ_COORDS !== 'false';

/**
 * Simple deterministic hash of a string → number in [0, 1).
 * Uses a seeded xorshift-style approach over the UTF-16 code units.
 */
function deterministicRandom(seed: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
    h >>>= 0;
  }
  // Second pass for better avalanche
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h >>>= 0;
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h >>>= 0;
  h ^= h >>> 16;
  return (h >>> 0) / 0x100000000;
}

/**
 * Fuzz a single coordinate pair by a severity-aware random offset.
 *
 * @param lat      Raw latitude from DB
 * @param lng      Raw longitude from DB
 * @param id       Incident UUID (used as seed for determinism)
 * @param severity Incident severity — higher severity = larger fuzz radius
 * @returns        { lat, lng } with privacy offset applied
 */
export function fuzzCoordinate(
  lat: number,
  lng: number,
  id: string,
  severity: string = 'medium'
): { lat: number; lng: number } {
  if (!FUZZ_ENABLED) return { lat, lng };

  // Radius in metres: critical/high use tighter fuzz (60 m) so responders can
  // still locate the incident; low severity uses looser fuzz (150 m) to better
  // protect reporter privacy for non-urgent reports.
  const radiusMetres =
    severity === 'critical' || severity === 'high' ? 60 :
    severity === 'low' ? 150 :
    100; // medium

  // Two independent pseudo-random values seeded on the incident ID
  const r1 = deterministicRandom(id + ':lat');
  const r2 = deterministicRandom(id + ':lng');

  // Convert metres to degrees (approximate; 1° lat ≈ 111_000 m)
  const latDegPerMetre = 1 / 111_000;
  const lngDegPerMetre = 1 / (111_000 * Math.cos((lat * Math.PI) / 180));

  // Map [0,1) → [-radius, +radius]
  const deltaLat = (r1 * 2 - 1) * radiusMetres * latDegPerMetre;
  const deltaLng = (r2 * 2 - 1) * radiusMetres * lngDegPerMetre;

  return {
    lat: lat + deltaLat,
    lng: lng + deltaLng,
  };
}

/**
 * Return a copy of an incident object with fuzzed lat/lng fields.
 * Expects the object to have `latitude`, `longitude`, `id`, and `severity` fields.
 */
export function withFuzzedCoords<T extends { latitude: number; longitude: number; id: string; severity?: string }>(
  incident: T
): T {
  if (!FUZZ_ENABLED) return incident;
  const { lat, lng } = fuzzCoordinate(
    incident.latitude,
    incident.longitude,
    incident.id,
    incident.severity
  );
  return { ...incident, latitude: lat, longitude: lng };
}
