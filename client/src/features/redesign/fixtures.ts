/**
 * Fixture data for the design-slice preview.
 *
 * NOT production data and never seeded into a database. Every organisation,
 * person and report below is invented for layout review, and the preview
 * labels itself as such on screen. No real municipal, police, fire or security
 * identity appears here — see the product guardrails in PROJECT-MEMORY.md §9.
 */

export interface ActivityItem {
  id: string;
  title: string;
  group: "services" | "nabor_note" | "emergency" | "critical";
  where: string;
  agoMinutes: number;
}

export interface RequestItem {
  id: string;
  title: string;
  organisation: string;
  state: "new" | "acknowledged" | "in_progress" | "resolved";
  updatedAgoHours: number;
  ageHours: number;
  lastUpdate: string;
}

export interface NoticeItem {
  id: string;
  organisation: string;
  title: string;
  body: string;
  agoHours: number;
}

export interface OrganisationItem {
  id: string;
  name: string;
  kind: "Municipality" | "Police" | "Fire service" | "Security service";
  blurb: string;
  verifiedOn: string;
  respondsVia: string;
}

export const AREA = "Swakopmund";

export const EMPTY_ACTIVITY: ActivityItem[] = [];

export const POPULATED_ACTIVITY: ActivityItem[] = [
  {
    id: "a1",
    title: "Water leak",
    group: "services",
    where: "Sam Nujoma Ave",
    agoMinutes: 35,
  },
  {
    id: "a2",
    title: "Lost pet",
    group: "nabor_note",
    where: "Vineta",
    agoMinutes: 190,
  },
  {
    id: "a3",
    title: "Road damage",
    group: "services",
    where: "Mile 4",
    agoMinutes: 420,
  },
  {
    id: "a4",
    title: "Power outage",
    group: "services",
    where: "Mondesa",
    agoMinutes: 700,
  },
];

export const POPULATED_REQUESTS: RequestItem[] = [
  {
    id: "r1",
    title: "Burst pipe outside 14 Example Street",
    organisation: "Example Town Water (sample)",
    state: "in_progress",
    updatedAgoHours: 3,
    ageHours: 26,
    lastUpdate: "Crew scheduled for tomorrow morning.",
  },
  {
    id: "r2",
    title: "Streetlight out on the corner",
    organisation: "Example Town Electricity (sample)",
    state: "acknowledged",
    updatedAgoHours: 19,
    ageHours: 44,
    lastUpdate: "Logged and queued for inspection.",
  },
];

export const POPULATED_NOTICES: NoticeItem[] = [
  {
    id: "n1",
    organisation: "Example Town Water (sample)",
    title: "Planned supply interruption on Thursday",
    body: "Mains work between 09:00 and 14:00. Store drinking water in advance.",
    agoHours: 5,
  },
];

export const POPULATED_ORGANISATIONS: OrganisationItem[] = [
  {
    id: "o1",
    name: "Example Town Water (sample)",
    kind: "Municipality",
    blurb: "Water supply, burst pipes, meters and billing queries.",
    verifiedOn: "14 August 2026",
    respondsVia: "Their duty officer sees requests in NaborNet.",
  },
  {
    id: "o2",
    name: "Example Neighbourhood Watch (sample)",
    kind: "Security service",
    blurb: "Volunteer patrol covering Vineta and Kramersdorf.",
    verifiedOn: "2 September 2026",
    respondsVia: "Their coordinator sees requests in NaborNet.",
  },
];

/** Staff queue, newest-and-unanswered first. Ages come from real timestamps. */
export const STAFF_QUEUE: RequestItem[] = [
  {
    id: "s1",
    title: "No water since this morning — 3 households",
    organisation: "Example Town Water (sample)",
    state: "new",
    updatedAgoHours: 2,
    ageHours: 2,
    lastUpdate: "Submitted by a resident. Not yet acknowledged.",
  },
  {
    id: "s2",
    title: "Meter reading looks wrong",
    organisation: "Example Town Water (sample)",
    state: "new",
    updatedAgoHours: 30,
    ageHours: 30,
    lastUpdate: "Submitted by a resident. Not yet acknowledged.",
  },
  {
    id: "s3",
    title: "Burst pipe outside 14 Example Street",
    organisation: "Example Town Water (sample)",
    state: "in_progress",
    updatedAgoHours: 3,
    ageHours: 26,
    lastUpdate: "Crew scheduled for tomorrow morning.",
  },
  {
    id: "s4",
    title: "Leaking tap at the sports field",
    organisation: "Example Town Water (sample)",
    state: "resolved",
    updatedAgoHours: 50,
    ageHours: 96,
    lastUpdate: "Washer replaced.",
  },
];

export const STATE_LABELS: Record<RequestItem["state"], string> = {
  new: "Not yet acknowledged",
  acknowledged: "Acknowledged",
  in_progress: "In progress",
  resolved: "Resolved",
};

export function relativeFromMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return hours === 1 ? "1 hour ago" : `${hours} hours ago`;
  const days = Math.round(hours / 24);
  return days === 1 ? "1 day ago" : `${days} days ago`;
}

export function relativeFromHours(hours: number): string {
  return relativeFromMinutes(hours * 60);
}
