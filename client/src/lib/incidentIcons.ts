// incidentIcons.ts
// Miniature Leaflet icons for each incident type using existing assets
// Uses the high-quality circular gradient icons from attached_assets

import L from 'leaflet';
import { INCIDENT_TYPES_BY_ID } from '@/features/report/incidentTypes';

// Import our 12 incident type assets
import icon1 from "@assets/1_1755387124843.png"; // Car Accident
import icon2 from "@assets/2_1755387124844.png"; // Emergency Alarm
import icon3 from "@assets/3_1755387124844.png"; // Break In/Burglary
import icon4 from "@assets/4_1755387124845.png"; // Construction Work
import icon5 from "@assets/5_1755387124845.png"; // Fire Emergency
import icon6 from "@assets/6_1755387124846.png"; // SOS/Need Help
import icon7 from "@assets/7_1755387124846.png"; // Lost Pet
import icon8 from "@assets/8_1755387124846.png"; // Suspicious Person
import icon9 from "@assets/9_1755387124847.png"; // Hit & Run
import icon10 from "@assets/10_1755387124847.png"; // Traffic Issue
import icon11 from "@assets/11_1755387124848.png"; // Lost & Found
import icon12 from "@assets/12_1755387124849.png"; // Violence/Fight

// Legacy imports for backwards compatibility
import lostPetIcon from '@assets/7_1755387124846.png';
import lostFoundIcon from '@assets/11_1755387124848.png';
import carAccidentIcon from '@assets/1_1755387124843.png';
import burglaryIcon from '@assets/3_1755387124844.png';
import suspiciousIcon from '@assets/8_1755387124846.png';
import trafficIcon from '@assets/10_1755387124847.png';
import constructionIcon from '@assets/4_1755387124845.png';
import alarmIcon from '@assets/2_1755387124844.png';
import fireIcon from '@assets/5_1755387124845.png';
import sosIcon from '@assets/6_1755387124846.png';
import violenceIcon from '@assets/12_1755387124849.png';
import hitRunIcon from '@assets/9_1755387124847.png';

// Map incident "type" to a specific icon file
const ICON_MAP: Record<string, string> = {
  "Car Accident": icon1,
  "Emergency Alarm": icon2,
  "Break In/Burglary": icon3,
  "Construction Work": icon4,
  "Fire Emergency": icon5,
  "SOS/Need Help": icon6,
  "Lost Pet": icon7,
  "Suspicious Person": icon8,
  "Hit & Run": icon9,
  "Traffic Issue": icon10,
  "Lost & Found": icon11,
  "Violence/Fight": icon12,
  // Fallback mappings for legacy types
  fire: icon5,
  medical: icon6,
  crime: icon3,
  traffic: icon10,
  outage: icon2,
  hazard: icon2,
  weather: icon2,
  rescue: icon6,
  animal: icon7,
  maintenance: icon4,
  community: icon11,
  other: icon12,
};

function createIncidentIcon(iconUrl: string, size = 24) {
  return L.icon({
    iconUrl: iconUrl,
    iconSize: [size, size],      // compact size for map markers
    iconAnchor: [size/2, size],  // bottom-center sits on lat/lng point
    popupAnchor: [0, -size],     // popup above the icon
    className: 'incident-marker-icon'
  });
}

// Define icons per category (matching incident type IDs)
export const INCIDENT_ICONS = {
  'lost_pet': createIncidentIcon(lostPetIcon),
  'lost_found': createIncidentIcon(lostFoundIcon),
  'accident': createIncidentIcon(carAccidentIcon),
  'car_accident': createIncidentIcon(carAccidentIcon),
  'break_in': createIncidentIcon(burglaryIcon),
  'break_in_burglary': createIncidentIcon(burglaryIcon),
  'burglary': createIncidentIcon(burglaryIcon),
  'suspicious_persons': createIncidentIcon(suspiciousIcon),
  'suspicious_person': createIncidentIcon(suspiciousIcon),
  'suspicious': createIncidentIcon(suspiciousIcon),
  'traffic': createIncidentIcon(trafficIcon),
  'construction': createIncidentIcon(constructionIcon),
  'alarm': createIncidentIcon(alarmIcon),
  'emergency_alarm': createIncidentIcon(alarmIcon),
  'fire': createIncidentIcon(fireIcon),
  'fire_emergency': createIncidentIcon(fireIcon),
  'help': createIncidentIcon(sosIcon),
  'sos_need_help': createIncidentIcon(sosIcon),
  'sos': createIncidentIcon(sosIcon),
  'violence': createIncidentIcon(violenceIcon),
  'violence_fight': createIncidentIcon(violenceIcon),
  'hit_and_run': createIncidentIcon(hitRunIcon),
  'hit_run': createIncidentIcon(hitRunIcon),
};

// Helper: get an icon safely, with new mapIcon field support and fallback
export function getIncidentIcon(type: string) {
  const url = ICON_MAP[type] ?? icon12;
  const size = window.devicePixelRatio > 1 ? [40, 40] : [28, 28];
  return L.icon({
    iconUrl: url,
    iconSize: size as [number, number],
    iconAnchor: [Math.floor(size[0] / 2), size[1]], // bottom-center
    className: "will-change-transform",
  });
}

// Legacy function for backwards compatibility
export function getIncidentIconLegacy(type: string, size = 24) {
  // First try the new mapIcon field from INCIDENT_TYPES_BY_ID
  const incidentType = INCIDENT_TYPES_BY_ID[type];
  if (incidentType?.mapIcon) {
    return createIncidentIcon(incidentType.mapIcon, size);
  }
  
  // Fallback to legacy INCIDENT_ICONS
  const icon = INCIDENT_ICONS[type as keyof typeof INCIDENT_ICONS];
  if (icon) {
    return createIncidentIcon(icon.options.iconUrl, size);
  }
  
  // Final fallback to a generic marker
  return createIncidentIcon(carAccidentIcon, size);
}

// Create accuracy circle for location precision visualization
export function createAccuracyCircle(lat: number, lng: number, accuracy: number) {
  const color = accuracy > 100 ? '#ef4444' : accuracy > 50 ? '#f59e0b' : '#10b981';
  
  return L.circle([lat, lng], {
    radius: accuracy,
    weight: 2,
    color: color,
    opacity: 0.6,
    fillOpacity: 0.1,
    fillColor: color
  });
}