/**
 * NaborNet Taxonomy v2 — Single Source of Truth
 * 
 * This file defines all incident groups, types, colors, and marker shapes.
 * Used by: Report selector, Feed cards, Map markers, Server validation
 * 
 * DO NOT import old incidentTypes.ts for new incidents.
 * Legacy mapping is provided for historical incidents only.
 * 
 * v1.1 Backlog: True circular carousel loop (infinite scroll)
 */

// ============================================================================
// MARKER SHAPES
// ============================================================================

export type MarkerShape = 'square' | 'circle' | 'cross' | 'pulse';

// ============================================================================
// GROUP DEFINITIONS
// ============================================================================

export type TaxonomyGroupId = 'services' | 'nabor_note' | 'emergency' | 'critical';

export interface TaxonomyGroup {
  id: TaxonomyGroupId;
  label: string;
  emoji: string;
  shape: MarkerShape;
  colorSpectrum: string; // Description for reference
  description: string;
}

export const TAXONOMY_GROUPS: Record<TaxonomyGroupId, TaxonomyGroup> = {
  services: {
    id: 'services',
    label: 'Services',
    emoji: '🟧',
    shape: 'square',
    colorSpectrum: 'Yellow → Amber → Orange',
    description: 'Civic / low urgency issues',
  },
  nabor_note: {
    id: 'nabor_note',
    label: 'Nabor Note',
    emoji: '🔵',
    shape: 'circle',
    colorSpectrum: 'Blue → Turquoise → Cyan',
    description: 'Community awareness',
  },
  emergency: {
    id: 'emergency',
    label: 'Emergency',
    emoji: '❌',
    shape: 'cross',
    colorSpectrum: 'Yellow-Orange → Orange-Red',
    description: 'Serious situations',
  },
  critical: {
    id: 'critical',
    label: 'Critical',
    emoji: '🔴',
    shape: 'pulse',
    colorSpectrum: 'Pure Red (pulsing)',
    description: 'Immediate response needed',
  },
};

export const TAXONOMY_GROUP_ORDER: TaxonomyGroupId[] = [
  'services',
  'nabor_note', 
  'emergency',
  'critical',
];

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface TaxonomyType {
  id: string;           // Canonical ID (e.g., "services.water_leak")
  groupId: TaxonomyGroupId;
  label: string;
  color: string;        // HEX color
  isCustom?: boolean;   // True for "Custom" type in each group
}

// SERVICES types (🟧 Square markers)
export const SERVICES_TYPES: TaxonomyType[] = [
  { id: 'services.water_leak', groupId: 'services', label: 'Water Leak', color: '#FFD84D' },
  { id: 'services.road_damage', groupId: 'services', label: 'Road Damage', color: '#FFC533' },
  { id: 'services.litter', groupId: 'services', label: 'Litter', color: '#FFDF80' },
  { id: 'services.power_outage', groupId: 'services', label: 'Power Outage', color: '#FFB300' },
  { id: 'services.internet_outage', groupId: 'services', label: 'Internet Outage', color: '#FF9800' },
  { id: 'services.custom', groupId: 'services', label: 'Custom', color: '#F57C00', isCustom: true },
];

// NABOR NOTE types (🔵 Circle markers)
export const NABOR_NOTE_TYPES: TaxonomyType[] = [
  { id: 'nabor_note.lost_found', groupId: 'nabor_note', label: 'Lost & Found', color: '#4FC3F7' },
  { id: 'nabor_note.lost_pet', groupId: 'nabor_note', label: 'Lost Pet', color: '#26C6DA' },
  { id: 'nabor_note.noise_complaint', groupId: 'nabor_note', label: 'Noise Complaint', color: '#0097A7' },
  { id: 'nabor_note.unknown_person', groupId: 'nabor_note', label: 'Unknown Person', color: '#00ACC1' },
  { id: 'nabor_note.unknown_vehicle', groupId: 'nabor_note', label: 'Unknown Vehicle', color: '#00838F' },
  { id: 'nabor_note.custom', groupId: 'nabor_note', label: 'Custom', color: '#006064', isCustom: true },
];

// EMERGENCY types (❌ Cross markers)
export const EMERGENCY_TYPES: TaxonomyType[] = [
  { id: 'emergency.fire', groupId: 'emergency', label: 'Fire', color: '#FF7043' },
  { id: 'emergency.gunshots', groupId: 'emergency', label: 'Gunshots', color: '#F4511E' },
  { id: 'emergency.medical', groupId: 'emergency', label: 'Medical', color: '#FB8C00' },
  { id: 'emergency.car_accident', groupId: 'emergency', label: 'Car Accident', color: '#FF6F00' },
  { id: 'emergency.theft', groupId: 'emergency', label: 'Theft', color: '#E65100' },
  { id: 'emergency.custom', groupId: 'emergency', label: 'Custom', color: '#D84315', isCustom: true },
];

// CRITICAL types (🔴 Pulsing circle markers)
export const CRITICAL_TYPES: TaxonomyType[] = [
  { id: 'critical.sos', groupId: 'critical', label: 'SOS – Immediate Help Needed', color: '#D32F2F' },
  { id: 'critical.custom', groupId: 'critical', label: 'Custom', color: '#D32F2F', isCustom: true },
];

// All types combined
export const ALL_TAXONOMY_TYPES: TaxonomyType[] = [
  ...SERVICES_TYPES,
  ...NABOR_NOTE_TYPES,
  ...EMERGENCY_TYPES,
  ...CRITICAL_TYPES,
];

// Types by group
export const TYPES_BY_GROUP: Record<TaxonomyGroupId, TaxonomyType[]> = {
  services: SERVICES_TYPES,
  nabor_note: NABOR_NOTE_TYPES,
  emergency: EMERGENCY_TYPES,
  critical: CRITICAL_TYPES,
};

// Lookup by ID
export const TAXONOMY_TYPES_BY_ID: Record<string, TaxonomyType> = Object.fromEntries(
  ALL_TAXONOMY_TYPES.map(t => [t.id, t])
);

// ============================================================================
// VALIDATION
// ============================================================================

/** All valid v2 type IDs for server validation */
export const VALID_V2_TYPE_IDS: Set<string> = new Set(ALL_TAXONOMY_TYPES.map(t => t.id));

/** Check if a type ID is a valid v2 type */
export function isValidV2Type(typeId: string): boolean {
  return VALID_V2_TYPE_IDS.has(typeId);
}

/** Get group ID from type ID (e.g., "services.water_leak" → "services") */
export function getGroupIdFromTypeId(typeId: string): TaxonomyGroupId | null {
  const parts = typeId.split('.');
  if (parts.length >= 1 && parts[0] in TAXONOMY_GROUPS) {
    return parts[0] as TaxonomyGroupId;
  }
  return null;
}

// ============================================================================
// LEGACY MAPPING (v1 → v2 display)
// ============================================================================

/** Maps old v1 type IDs to v2 type IDs for display purposes only */
export const LEGACY_TYPE_MAPPING: Record<string, string> = {
  // Low severity (v1) → Services/Nabor Note (v2)
  'blocked_road': 'services.road_damage',
  'construction': 'services.road_damage',
  'heavy_traffic': 'services.road_damage',
  'lost_found': 'nabor_note.lost_found',
  'lost_pet': 'nabor_note.lost_pet',
  'noise_complaint': 'nabor_note.noise_complaint',
  'police_traffic_stop': 'nabor_note.custom',
  
  // Medium severity (v1) → Emergency/Nabor Note (v2)
  'accident': 'emergency.car_accident',
  'break_in': 'emergency.theft',
  'suspicious_persons': 'nabor_note.unknown_person',
  'suspicious_vehicle': 'nabor_note.unknown_vehicle',
  'police_activity': 'nabor_note.custom',
  'speed_camera': 'nabor_note.custom',
  
  // High severity (v1) → Emergency (v2)
  'fire': 'emergency.fire',
  'gun_shots': 'emergency.gunshots',
  'medical': 'emergency.medical',
  'theft': 'emergency.theft',
  'violence': 'emergency.custom',
  
  // Critical (v1) → Critical (v2)
  'help': 'critical.sos',
};

/** Resolve a type ID to v2 (handles both legacy and v2 IDs) */
export function resolveToV2Type(typeId: string): TaxonomyType | null {
  // Already a v2 type
  if (TAXONOMY_TYPES_BY_ID[typeId]) {
    return TAXONOMY_TYPES_BY_ID[typeId];
  }
  
  // Check legacy mapping
  const mappedId = LEGACY_TYPE_MAPPING[typeId];
  if (mappedId && TAXONOMY_TYPES_BY_ID[mappedId]) {
    return TAXONOMY_TYPES_BY_ID[mappedId];
  }
  
  // Unknown type - return null (caller should use fallback)
  return null;
}

// ============================================================================
// UI HELPERS
// ============================================================================

/** Get CSS classes for group-based card styling */
export function getGroupCardClasses(groupId: TaxonomyGroupId): string {
  switch (groupId) {
    case 'services':
      return 'bg-amber-50 border-amber-300 dark:bg-amber-950 dark:border-amber-800';
    case 'nabor_note':
      return 'bg-cyan-50 border-cyan-300 dark:bg-cyan-950 dark:border-cyan-800';
    case 'emergency':
      return 'bg-orange-50 border-orange-300 dark:bg-orange-950 dark:border-orange-800';
    case 'critical':
      return 'bg-red-50 border-red-300 dark:bg-red-950 dark:border-red-800';
    default:
      return 'bg-slate-50 border-slate-300 dark:bg-slate-900 dark:border-slate-700';
  }
}

/** Get CSS classes for group badge */
export function getGroupBadgeClasses(groupId: TaxonomyGroupId): string {
  switch (groupId) {
    case 'services':
      return 'bg-amber-500 text-white';
    case 'nabor_note':
      return 'bg-cyan-600 text-white';
    case 'emergency':
      return 'bg-orange-600 text-white';
    case 'critical':
      return 'bg-red-600 text-white';
    default:
      return 'bg-slate-500 text-white';
  }
}

/** Get marker shape for a type */
export function getMarkerShape(typeId: string): MarkerShape {
  const type = resolveToV2Type(typeId);
  if (!type) return 'circle'; // Fallback
  return TAXONOMY_GROUPS[type.groupId].shape;
}

/** Get marker color for a type */
export function getMarkerColor(typeId: string): string {
  const type = resolveToV2Type(typeId);
  if (!type) return '#6B7280'; // Gray fallback
  return type.color;
}

/** Get group for a type */
export function getGroupForType(typeId: string): TaxonomyGroup | null {
  const type = resolveToV2Type(typeId);
  if (!type) return null;
  return TAXONOMY_GROUPS[type.groupId];
}

// ============================================================================
// SEVERITY DERIVATION (for compatibility with existing code)
// ============================================================================

/** Derive severity from v2 group (for backwards compatibility) */
export function deriveSeverityFromGroup(groupId: TaxonomyGroupId): 'low' | 'medium' | 'high' | 'critical' {
  switch (groupId) {
    case 'services': return 'low';
    case 'nabor_note': return 'medium';
    case 'emergency': return 'high';
    case 'critical': return 'critical';
    default: return 'medium';
  }
}

/** Get severity for a type ID (works with both v1 and v2 types) */
export function getSeverityForType(typeId: string): 'low' | 'medium' | 'high' | 'critical' {
  const type = resolveToV2Type(typeId);
  if (!type) return 'medium'; // Safe default
  return deriveSeverityFromGroup(type.groupId);
}

// ============================================================================
// PULSE EFFECT (for critical markers)
// ============================================================================

export const CRITICAL_PULSE_ACCENT = '#FF5252';

// ============================================================================
// TAXONOMY VERSION (for incident payloads)
// ============================================================================

export const CURRENT_TAXONOMY_VERSION = 2;

/** Check if a type ID is v2 format (contains dot separator) */
export function isV2TypeId(typeId: string): boolean {
  return typeId.includes('.');
}

/** Infer taxonomy version from type ID */
export function inferTaxonomyVersion(typeId: string): 1 | 2 {
  return isV2TypeId(typeId) ? 2 : 1;
}
