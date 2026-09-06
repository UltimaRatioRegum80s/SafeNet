/**
 * Report categories for the redesigned reporting entry.
 *
 * Same groups and same type IDs as `features/report/taxonomyV2` — nothing is
 * added, removed or renamed. The only change is presentational: each type gets
 * a real icon instead of the first letter of its label, so the grid no longer
 * shows "W", "R", "L", "P", "I", "U", "U" and expect people to decode it.
 */
import {
  AlertTriangle,
  Car,
  CarFront,
  Flame,
  HeartPulse,
  PawPrint,
  Plus,
  Search,
  ShieldAlert,
  Siren,
  TrafficCone,
  Trash2,
  UserRound,
  Volume2,
  WifiOff,
  ZapOff,
  Droplets,
  type LucideIcon,
} from "lucide-react";
import { TYPES_BY_GROUP, type TaxonomyGroupId } from "@/features/report/taxonomyV2";

export const TYPE_ICONS: Record<string, LucideIcon> = {
  "services.water_leak": Droplets,
  "services.road_damage": TrafficCone,
  "services.litter": Trash2,
  "services.power_outage": ZapOff,
  "services.internet_outage": WifiOff,
  "services.custom": Plus,

  "nabor_note.lost_found": Search,
  "nabor_note.lost_pet": PawPrint,
  "nabor_note.noise_complaint": Volume2,
  "nabor_note.unknown_person": UserRound,
  "nabor_note.unknown_vehicle": Car,
  "nabor_note.custom": Plus,

  "emergency.fire": Flame,
  "emergency.gunshots": AlertTriangle,
  "emergency.medical": HeartPulse,
  "emergency.car_accident": CarFront,
  "emergency.theft": ShieldAlert,
  "emergency.custom": Plus,

  "critical.sos": Siren,
  "critical.custom": Plus,
};

export function iconForType(typeId: string): LucideIcon {
  return TYPE_ICONS[typeId] ?? AlertTriangle;
}

/**
 * Plain-language group headings for the reporting entry. The taxonomy's own
 * labels ("Services", "Nabor Note") name the marker groups; these name the
 * situation a resident is actually in.
 */
export const GROUP_HEADINGS: Record<TaxonomyGroupId, { title: string; help: string }> = {
  services: {
    title: "Everyday issues",
    help: "Water, roads, power, waste and similar.",
  },
  nabor_note: {
    title: "Neighbourhood notes",
    help: "Things worth telling neighbours about.",
  },
  emergency: {
    title: "Serious incidents",
    help: "Already reported to emergency services? Post it here so neighbours know.",
  },
  critical: {
    title: "Immediate danger",
    help: "Call emergency services first. NaborNet does not dispatch anyone.",
  },
};

export const GROUP_ORDER_FOR_REPORTING: TaxonomyGroupId[] = [
  "services",
  "nabor_note",
  "emergency",
  "critical",
];

export { TYPES_BY_GROUP };
