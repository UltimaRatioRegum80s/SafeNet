/**
 * Server-side Taxonomy v2 Validation
 * 
 * This file provides server-side validation for v2 incident type IDs.
 * It mirrors the client-side taxonomy but only includes what's needed for validation.
 */

// All valid v2 type IDs (must match client/src/features/report/taxonomyV2.ts)
export const VALID_V2_TYPE_IDS = new Set([
  // SERVICES (civic / low urgency)
  'services.water_leak',
  'services.road_damage',
  'services.litter',
  'services.power_outage',
  'services.internet_outage',
  'services.custom',
  
  // NABOR NOTE (community / awareness)
  'nabor_note.lost_found',
  'nabor_note.lost_pet',
  'nabor_note.noise_complaint',
  'nabor_note.unknown_person',
  'nabor_note.unknown_vehicle',
  'nabor_note.custom',
  
  // EMERGENCY (serious situations)
  'emergency.fire',
  'emergency.gunshots',
  'emergency.medical',
  'emergency.car_accident',
  'emergency.theft',
  'emergency.custom',
  
  // CRITICAL (immediate response)
  'critical.sos',
  'critical.custom',
]);

// Legacy v1 type IDs that are still accepted (for backwards compatibility)
export const LEGACY_V1_TYPE_IDS = new Set([
  'blocked_road',
  'construction',
  'heavy_traffic',
  'lost_found',
  'lost_pet',
  'noise_complaint',
  'police_traffic_stop',
  'accident',
  'break_in',
  'suspicious_persons',
  'suspicious_vehicle',
  'police_activity',
  'speed_camera',
  'fire',
  'gun_shots',
  'medical',
  'theft',
  'violence',
  'help',
  'other', // Fallback type
]);

/**
 * Check if a type ID is a valid v2 type
 */
export function isValidV2Type(typeId: string): boolean {
  return VALID_V2_TYPE_IDS.has(typeId);
}

/**
 * Check if a type ID is a valid legacy v1 type
 */
export function isValidLegacyType(typeId: string): boolean {
  return LEGACY_V1_TYPE_IDS.has(typeId);
}

/**
 * Check if a type ID is valid (either v2 or legacy v1)
 * Use this for incoming incident creation validation
 */
export function isValidIncidentType(typeId: string): boolean {
  return isValidV2Type(typeId) || isValidLegacyType(typeId);
}

/**
 * Infer taxonomy version from type ID format
 * v2 types contain a dot separator (e.g., "services.water_leak")
 * v1 types use underscore-separated words (e.g., "water_leak")
 */
export function inferTaxonomyVersion(typeId: string): 1 | 2 {
  return typeId.includes('.') ? 2 : 1;
}

/**
 * Get group ID from v2 type ID
 * Returns null for v1 types
 */
export function getGroupIdFromTypeId(typeId: string): string | null {
  if (!typeId.includes('.')) return null;
  const parts = typeId.split('.');
  return parts[0] || null;
}

/**
 * Derive severity from v2 group ID
 * Used for backwards compatibility with existing severity-based logic
 */
export function deriveSeverityFromGroup(groupId: string): 'low' | 'medium' | 'high' | 'critical' {
  switch (groupId) {
    case 'services': return 'low';
    case 'nabor_note': return 'medium';
    case 'emergency': return 'high';
    case 'critical': return 'critical';
    default: return 'medium';
  }
}

/**
 * Get severity for a type ID (works with both v1 and v2 types)
 */
export function getSeverityForType(typeId: string): 'low' | 'medium' | 'high' | 'critical' {
  const groupId = getGroupIdFromTypeId(typeId);
  if (groupId) {
    return deriveSeverityFromGroup(groupId);
  }
  // For v1 types, keep existing severity from the request
  return 'medium'; // Safe default
}

export const CURRENT_TAXONOMY_VERSION = 2;
