// Legacy imports (no longer used - replaced by new severity-based icons)
// Keeping for reference only

// Import new yellow low-risk icons (button + map variants)
import blockedRoadButton from '@assets/Blocked Road_1756578373730.png';
import blockedRoadMap from '@assets/Blocked Road MM_1756578373729.png';
import constructionButtonNew from '@assets/Construction_1756578373732.png';
import constructionMapNew from '@assets/Construction MM_1756578373731.png';
import heavyTrafficButton from '@assets/Heavy Traffic_1756578373733.png';
import heavyTrafficMap from '@assets/Heavy Traffic MM_1756578373733.png';
import lostFoundButtonNew from '@assets/Lost & Found_1756578373734.png';
import lostFoundMapNew from '@assets/Lost & Found MM_1756578373734.png';
import lostPetButtonNew from '@assets/Lost Pet_1756578373735.png';
import lostPetMapNew from '@assets/Lost Pet MM_1756578373734.png';
import noiseComplaintButton from '@assets/Noise Complaint_1756578373735.png';
import noiseComplaintMap from '@assets/Noise Complaint MM_1756578373735.png';
import policeTrafficButton from '@assets/Police Traffic Stop_1756578373728.png';
import policeTrafficMap from '@assets/Police Traffic Stop MM_1756578373726.png';

// Import new amber medium-risk icons (button + map variants)
import carAccidentButtonNew from '@assets/Car Accident_1756580323424.png';
import carAccidentMapNew from '@assets/Car Accident MM_1756580323423.png';
import breakInButtonNew from '@assets/Break In_1756580323422.png';
import breakInMapNew from '@assets/Break In MM_1756580323421.png';
import suspiciousPersonButtonNew from '@assets/Suspicious Person_1756580323427.png';
import suspiciousPersonMapNew from '@assets/Suspicious Person MM_1756580323426.png';
import suspiciousVehicleButton from '@assets/Suspicious Vehicle_1756580323420.png';
import suspiciousVehicleMap from '@assets/Suspicious Vehicle  MM_1756580323418.png';
import policeActivityButton from '@assets/Police Activity_1756580323425.png';
import policeActivityMap from '@assets/Police Activity MM_1756580323424.png';
import speedCameraButton from '@assets/Speed Camera_1756580323426.png';
import speedCameraMap from '@assets/Speed Camera MM_1756580323425.png';

// Import new red high-risk icons (button + map variants)
import fireButtonNew from '@assets/Fire_1756581094826.png';
import fireMapNew from '@assets/Fire MM_1756581094825.png';
import gunShotsButton from '@assets/Gun Shots_1756581094828.png';
import gunShotsMap from '@assets/Gun Shots MM_1756581094827.png';
import sosButtonNew from '@assets/Immediate Help Needed_1756581094829.png';
import sosMapNew from '@assets/Immediate Help Needed MM_1756581094828.png';
import medicalButton from '@assets/Medical Emergancy_1756581094830.png';
import medicalMap from '@assets/Medical Emergancy MM_1756581094829.png';
import theftButton from '@assets/Theft_1756581094823.png';
import theftMap from '@assets/Theft MM_1756581094821.png';
import violenceButtonNew from '@assets/Violence_1756581094824.png';
import violenceMapNew from '@assets/Violence MM_1756581094823.png';

export type Severity = "low" | "medium" | "high" | "critical";

export type IncidentType = {
  id: string;
  label: string;
  severity: Severity;
  iconSrc: string;
  /** Round icon (Quick Report) */
  buttonIcon?: string;
  /** Map pin (Leaflet markers) */
  mapIcon?: string;
};

export const INCIDENT_TYPES: IncidentType[] = [
  // 🟡 Low-risk (yellow) — using properly imported assets
  {
    id: "blocked_road",
    label: "Blocked Road",
    severity: "low",
    iconSrc: blockedRoadButton,
    buttonIcon: blockedRoadButton,
    mapIcon: blockedRoadMap,
  },
  {
    id: "construction",
    label: "Construction",
    severity: "low",
    iconSrc: constructionButtonNew,
    buttonIcon: constructionButtonNew,
    mapIcon: constructionMapNew,
  },
  {
    id: "heavy_traffic",
    label: "Heavy Traffic",
    severity: "low",
    iconSrc: heavyTrafficButton,
    buttonIcon: heavyTrafficButton,
    mapIcon: heavyTrafficMap,
  },
  {
    id: "lost_found",
    label: "Lost & Found",
    severity: "low",
    iconSrc: lostFoundButtonNew,
    buttonIcon: lostFoundButtonNew,
    mapIcon: lostFoundMapNew,
  },
  {
    id: "lost_pet",
    label: "Lost Pet",
    severity: "low",
    iconSrc: lostPetButtonNew,
    buttonIcon: lostPetButtonNew,
    mapIcon: lostPetMapNew,
  },
  {
    id: "noise_complaint",
    label: "Noise Complaint",
    severity: "low",
    iconSrc: noiseComplaintButton,
    buttonIcon: noiseComplaintButton,
    mapIcon: noiseComplaintMap,
  },
  {
    id: "police_traffic_stop",
    label: "Police Traffic Stop",
    severity: "low",
    iconSrc: policeTrafficButton,
    buttonIcon: policeTrafficButton,
    mapIcon: policeTrafficMap,
  },
  // 🟠 Medium-risk (amber) — using new uploaded assets
  {
    id: "accident",
    label: "Car Accident",
    severity: "medium",
    iconSrc: carAccidentButtonNew,
    buttonIcon: carAccidentButtonNew,
    mapIcon: carAccidentMapNew,
  },
  {
    id: "break_in",
    label: "Break In / Burglary",
    severity: "medium",
    iconSrc: breakInButtonNew,
    buttonIcon: breakInButtonNew,
    mapIcon: breakInMapNew,
  },
  {
    id: "suspicious_persons",
    label: "Suspicious Person",
    severity: "medium",
    iconSrc: suspiciousPersonButtonNew,
    buttonIcon: suspiciousPersonButtonNew,
    mapIcon: suspiciousPersonMapNew,
  },
  {
    id: "suspicious_vehicle",
    label: "Suspicious Vehicle",
    severity: "medium",
    iconSrc: suspiciousVehicleButton,
    buttonIcon: suspiciousVehicleButton,
    mapIcon: suspiciousVehicleMap,
  },
  {
    id: "police_activity",
    label: "Police Activity",
    severity: "medium",
    iconSrc: policeActivityButton,
    buttonIcon: policeActivityButton,
    mapIcon: policeActivityMap,
  },
  {
    id: "speed_camera",
    label: "Speed Camera",
    severity: "medium",
    iconSrc: speedCameraButton,
    buttonIcon: speedCameraButton,
    mapIcon: speedCameraMap,
  },
  // 🔴 High/Critical (red) — using new uploaded assets  
  {
    id: "fire",
    label: "Fire Emergency",
    severity: "high",
    iconSrc: fireButtonNew,
    buttonIcon: fireButtonNew,
    mapIcon: fireMapNew,
  },
  {
    id: "gun_shots",
    label: "Gun Shots",
    severity: "high",
    iconSrc: gunShotsButton,
    buttonIcon: gunShotsButton,
    mapIcon: gunShotsMap,
  },
  {
    id: "help",
    label: "Immediate Help Needed",
    severity: "critical",
    iconSrc: sosButtonNew,
    buttonIcon: sosButtonNew,
    mapIcon: sosMapNew,
  },
  {
    id: "medical",
    label: "Medical Emergency",
    severity: "high",
    iconSrc: medicalButton,
    buttonIcon: medicalButton,
    mapIcon: medicalMap,
  },
  {
    id: "theft",
    label: "Theft",
    severity: "high",
    iconSrc: theftButton,
    buttonIcon: theftButton,
    mapIcon: theftMap,
  },
  {
    id: "violence",
    label: "Violence / Fight",
    severity: "high",
    iconSrc: violenceButtonNew,
    buttonIcon: violenceButtonNew,
    mapIcon: violenceMapNew,
  },
] as const;

export const INCIDENT_TYPES_BY_ID = Object.fromEntries(
  INCIDENT_TYPES.map(t => [t.id, t])
) as Record<string, IncidentType>;

// Unified severity color system - Traffic light pattern (Yellow → Amber → Red → Deep Red)
export const getSeverityColor = (severity: string) => {
  switch (severity) {
    case 'critical': 
      return 'bg-red-200 border-red-400 hover:bg-red-300 dark:bg-red-950 dark:border-red-800 dark:hover:bg-red-900';
    case 'high': 
      return 'bg-red-100 border-red-300 hover:bg-red-200 dark:bg-red-900 dark:border-red-700 dark:hover:bg-red-800';
    case 'medium': 
      return 'bg-amber-100 border-amber-300 hover:bg-amber-200 dark:bg-amber-900 dark:border-amber-700 dark:hover:bg-amber-800';
    case 'low': 
      return 'bg-yellow-100 border-yellow-300 hover:bg-yellow-200 dark:bg-yellow-900 dark:border-yellow-700 dark:hover:bg-yellow-800';
    default: 
      return 'bg-slate-100 border-slate-300 hover:bg-slate-200 dark:bg-slate-800 dark:border-slate-700 dark:hover:bg-slate-700';
  }
};

// Severity badge colors (for compact badges with solid backgrounds)
export const getSeverityBadgeColor = (severity: string) => {
  switch (severity) {
    case 'critical': return 'bg-red-700 text-white border-red-800';
    case 'high': return 'bg-red-500 text-white border-red-600';
    case 'medium': return 'bg-amber-500 text-white border-amber-600';
    case 'low': return 'bg-yellow-500 text-white border-yellow-600';
    default: return 'bg-slate-500 text-white border-slate-600';
  }
};

// Development asset checking
if (import.meta.env.DEV) {
  for (const t of INCIDENT_TYPES) {
    for (const k of ["buttonIcon", "mapIcon"] as const) {
      if (t[k]) {
        fetch(t[k]!, { method: "HEAD" }).then(r => {
          if (!r.ok) console.warn("Missing icon asset:", t.id, k, t[k]);
        }).catch(() => console.warn("Missing icon asset:", t.id, k, t[k]));
      }
    }
  }
}