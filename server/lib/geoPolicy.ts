/**
 * GeoPolicy Module
 * 
 * Enforces geography-based access controls for NaborNet.
 * Currently supports:
 * - Southern Africa (default, public beta)
 * - Kenya (private field test, whitelist-only visibility)
 */

// Environment flag for Kenya field test
const KENYA_FIELD_TEST_ENABLED = process.env.KENYA_FIELD_TEST_ENABLED === 'true';

// Whitelisted emails (same list used for signup)
function getWhitelistedEmails(): string[] {
  const allowedEmails = process.env.ALLOWED_EMAILS || '';
  return allowedEmails.split(',').map(e => e.trim().toLowerCase()).filter(Boolean);
}

// Geographic bounding boxes
// Kenya: approx -5° to 5° lat, 34° to 42° lng
const KENYA_BBOX = {
  minLat: -5.0,
  maxLat: 5.0,
  minLng: 34.0,
  maxLng: 42.0,
};

// Southern Africa: approx -35° to -10° lat, 10° to 40° lng
// Covers Namibia, South Africa, Botswana, Zimbabwe, Mozambique, etc.
const SOUTHERN_AFRICA_BBOX = {
  minLat: -35.0,
  maxLat: -10.0,
  minLng: 10.0,
  maxLng: 42.0,
};

export interface GeoPoint {
  lat: number;
  lng: number;
}

/**
 * Check if coordinates are within Kenya
 */
export function isInKenya(point: GeoPoint): boolean {
  return (
    point.lat >= KENYA_BBOX.minLat &&
    point.lat <= KENYA_BBOX.maxLat &&
    point.lng >= KENYA_BBOX.minLng &&
    point.lng <= KENYA_BBOX.maxLng
  );
}

/**
 * Check if coordinates are within Southern Africa
 */
export function isInSouthernAfrica(point: GeoPoint): boolean {
  return (
    point.lat >= SOUTHERN_AFRICA_BBOX.minLat &&
    point.lat <= SOUTHERN_AFRICA_BBOX.maxLat &&
    point.lng >= SOUTHERN_AFRICA_BBOX.minLng &&
    point.lng <= SOUTHERN_AFRICA_BBOX.maxLng
  );
}

/**
 * Determine country code from coordinates
 * Returns 'KE' for Kenya, 'ZA' for generic Southern Africa
 */
export function getCountryCode(point: GeoPoint): string | null {
  if (isInKenya(point)) {
    return 'KE';
  }
  if (isInSouthernAfrica(point)) {
    // Generic Southern Africa code (could be NA, ZA, BW, etc.)
    // We use 'ZA' as default but this is approximate
    return 'ZA';
  }
  return null;
}

/**
 * Check if email is on the whitelist
 */
export function isWhitelistedEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const whitelist = getWhitelistedEmails();
  return whitelist.includes(email.toLowerCase());
}

/**
 * Check if Kenya field test is enabled
 */
export function isKenyaFieldTestEnabled(): boolean {
  return KENYA_FIELD_TEST_ENABLED;
}

/**
 * Determine visibility scope for a new incident based on location
 * - Kenya incidents get 'private_whitelist' scope
 * - All other incidents get 'public_beta' scope
 */
export function getVisibilityScope(point: GeoPoint): 'public_beta' | 'private_whitelist' {
  if (isInKenya(point)) {
    return 'private_whitelist';
  }
  return 'public_beta';
}

/**
 * Policy check: Can a user CREATE an incident at this location?
 * 
 * Rules:
 * - Southern Africa: Always allowed (with existing auth checks)
 * - Kenya: Only allowed if KENYA_FIELD_TEST_ENABLED=true
 * - Other locations: Not allowed
 */
export function canCreateIncidentAtLocation(point: GeoPoint, userEmail?: string | null): { allowed: boolean; reason?: string } {
  // Southern Africa - always allowed
  if (isInSouthernAfrica(point)) {
    return { allowed: true };
  }
  
  // Kenya - only if field test enabled
  if (isInKenya(point)) {
    if (!KENYA_FIELD_TEST_ENABLED) {
      return { 
        allowed: false, 
        reason: 'Incident creation is not available in this region.' 
      };
    }
    // Kenya field test is enabled - allow creation (existing auth/whitelist checks still apply)
    return { allowed: true };
  }
  
  // Outside allowed regions
  return { 
    allowed: false, 
    reason: 'Incident creation is only available in Southern Africa.' 
  };
}

/**
 * Policy check: Can a user VIEW incidents with a given visibility scope?
 * 
 * Rules:
 * - public_beta: Anyone can view
 * - private_whitelist: Only whitelisted emails can view
 */
export function canViewIncident(
  visibilityScope: string | null, 
  userEmail: string | null | undefined
): boolean {
  // Public incidents are visible to all
  if (!visibilityScope || visibilityScope === 'public_beta') {
    return true;
  }
  
  // Private whitelist incidents require whitelisted email
  if (visibilityScope === 'private_whitelist') {
    return isWhitelistedEmail(userEmail);
  }
  
  // Unknown scope - default to not visible
  return false;
}

/**
 * Get SQL filter condition for visibility based on user email
 * Returns conditions that should be applied to incident queries
 */
export function getVisibilityFilter(userEmail: string | null | undefined): {
  includePrivate: boolean;
} {
  return {
    includePrivate: isWhitelistedEmail(userEmail),
  };
}
