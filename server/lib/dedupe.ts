import crypto from "crypto";

/**
 * Enhanced content processing utilities for NaborNet
 * Phase 1: Improved sanitization and normalization without Redis dependency
 */

// Environment variables with sensible defaults
export const CONFIG = {
  DEDUPE_RADIUS_METERS: Number(process.env.DEDUPE_RADIUS_METERS) || 100,
  DEDUPE_WINDOW_MINUTES: Number(process.env.DEDUPE_WINDOW_MINUTES) || 10,
  IDEMPOTENCY_TTL_SEC: Number(process.env.IDEMPOTENCY_TTL_SEC) || 900, // 15 minutes
  RATE_LIMITS_INCIDENT_WINDOW_SEC: Number(process.env.RATE_LIMITS_INCIDENT_WINDOW_SEC) || 10,
  RATE_LIMITS_INCIDENT_ANON_WINDOW_SEC: Number(process.env.RATE_LIMITS_INCIDENT_ANON_WINDOW_SEC) || 20,
};

/**
 * Basic text sanitization - removes HTML tags and control characters
 */
export function sanitizeText(s?: string): string {
  if (!s) return "";
  return s.replace(/<[^>]*>/g, "").replace(/[\x00-\x1f\x7f-\x9f]/g, "");
}

/**
 * Enhanced text normalization for duplicate detection
 * Converts to lowercase, normalizes whitespace, removes common noise
 */
export function normalizeText(s?: string): string {
  if (!s) return "";
  return sanitizeText(s)
    .toLowerCase()
    .replace(/\s+/g, " ") // Normalize whitespace
    .replace(/[^\w\s]/g, "") // Remove punctuation for better matching
    .trim();
}

/**
 * Grid-based spatial bucketing for fast duplicate detection
 * Groups nearby coordinates into the same cell
 */
export function gridCell(lat: number, lon: number, meters: number = 50): string {
  const latStep = meters / 111_320; // degrees per meter (approximate)
  const lonStep = meters / (111_320 * Math.cos((lat * Math.PI) / 180));
  const latCell = Math.floor(lat / latStep);
  const lonCell = Math.floor(lon / lonStep);
  return `${latCell}:${lonCell}:${meters}`;
}

/**
 * Generate content-based hash for duplicate detection
 * Combines incident type, normalized title, and spatial grid cell
 */
export function incidentContentKey(
  type: string,
  title: string,
  lat: number,
  lon: number,
  gridMeters: number = 50
): string {
  const normalizedContent = normalizeText(`${type}|${title}`);
  const cell = gridCell(lat, lon, gridMeters);
  return crypto
    .createHash("sha256")
    .update(`${normalizedContent}|${cell}`)
    .digest("hex")
    .substring(0, 16); // Short hash for efficiency
}

/**
 * Validate coordinates are within reasonable bounds
 * Focuses on Southern African region (Namibia, South Africa, Botswana)
 */
export function validateCoordinates(lat: number, lon: number): boolean {
  // Southern African bounds (expanded from original Namibia-only check)
  const minLat = -35; // Southern tip of South Africa
  const maxLat = -16; // Northern Namibia
  const minLon = 11;  // Western Namibia
  const maxLon = 33;  // Eastern South Africa
  
  return lat >= minLat && lat <= maxLat && lon >= minLon && lon <= maxLon;
}

/**
 * Calculate distance between two points using Haversine formula
 * Returns distance in meters
 */
export function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371000; // Earth's radius in meters
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}