/**
 * Feature Flags - Client-side feature gating
 * 
 * Flags are read from Vite environment variables (VITE_* prefix).
 * Default values are conservative (features OFF by default).
 */

export function isExpressReportEnabled(): boolean {
  const value = import.meta.env.VITE_EXPRESS_REPORT_ENABLED;
  return value === 'true';
}

export const EXPRESS_REPORT_CONFIG = {
  LONG_PRESS_DURATION_MS: 3000,
  COOLDOWN_DURATION_MS: 30000,
  MOVEMENT_THRESHOLD_PX: 15,
  INCIDENT_TYPE: 'nabor_note.custom',
} as const;
