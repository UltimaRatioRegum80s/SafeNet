import webpush from "web-push";
import { storage } from "./storage";
import type { PushSubscription } from "@shared/schema";

// VAPID configuration
const VAPID_PUBLIC = process.env.VAPID_PUBLIC || 'BLVHp22wYxnXnegSKvbeUVMymhM06k-fptGnLvJJPn-H2_gbYnR2IFTffKLPq4b0W80oWBj693o4J17jH7eKGJU';
const VAPID_PRIVATE = process.env.VAPID_PRIVATE || 'Jhx8vOZJOMry8OUs8BGR6Y3BXEX-4ZsNZD2kjy-62mk';

webpush.setVapidDetails("mailto:alerts@nabornet.app", VAPID_PUBLIC, VAPID_PRIVATE);

export interface PushPayload {
  title: string;
  body: string;
  tag?: string;
  link?: string;
  icon?: string;
  badge?: string;
}

export async function sendPush(subscription: PushSubscription, payload: PushPayload) {
  try {
    const sub = {
      endpoint: subscription.endpoint,
      keys: {
        p256dh: subscription.p256dh,
        auth: subscription.auth
      }
    };

    const options = {
      TTL: 30,
      urgency: payload.tag?.includes('critical') ? 'high' : 'normal'
    };

    await webpush.sendNotification(sub, JSON.stringify(payload), options as any);
    console.log(`✅ Push sent to ${subscription.endpoint.slice(0, 50)}...`);
  } catch (error: any) {
    console.error('❌ Push notification failed:', error.message);
    
    // Handle expired/invalid subscriptions
    if (error.statusCode === 410 || error.statusCode === 404) {
      console.log(`🗑️ Removing expired subscription: ${subscription.endpoint.slice(0, 50)}...`);
      await storage.removePushSubscription(subscription.endpoint);
    }
  }
}

export async function sendPushToNeighborhood(
  neighbourhoodId: string, 
  payload: PushPayload, 
  filterByTypes?: string[]
) {
  try {
    const subscriptions = await storage.getPushSubscriptionsByNeighborhood(neighbourhoodId);
    
    const filteredSubs = filterByTypes 
      ? subscriptions.filter((sub: PushSubscription) => 
          sub.types.length === 0 || // all types if empty array
          filterByTypes.some(type => sub.types.includes(type))
        )
      : subscriptions;

    if (filteredSubs.length === 0) {
      console.log(`📭 No active subscriptions for neighborhood: ${neighbourhoodId}`);
      return;
    }

    console.log(`📤 Sending push to ${filteredSubs.length} subscribers in ${neighbourhoodId}`);
    
    // Send notifications in parallel
    await Promise.allSettled(
      filteredSubs
        .filter((sub: PushSubscription) => sub.isActive)
        .map((sub: PushSubscription) => sendPush(sub, payload))
    );
  } catch (error) {
    console.error('❌ Failed to send neighborhood push:', error);
  }
}

export async function sendIncidentPush(incident: any) {
  const payload: PushPayload = {
    title: `${incident.severity.toUpperCase()}: ${incident.title}`,
    body: `${incident.description.slice(0, 100)}${incident.description.length > 100 ? '...' : ''}`,
    tag: `incident:${incident.id}`,
    link: `/community/map?focus=${incident.id}`,
    icon: '/icons/icon-192.png',
    badge: '/icons/badge.png'
  };

  // Determine neighborhood from coordinates or user data
  const neighbourhoodId = incident.neighbourhoodId || 
    await getNeighborhoodFromCoords(incident.latitude, incident.longitude);

  if (neighbourhoodId) {
    await sendPushToNeighborhood(neighbourhoodId, payload, [incident.type]);
  }
}

// Helper to determine neighborhood from coordinates
async function getNeighborhoodFromCoords(lat: number, lng: number): Promise<string | null> {
  // Simple implementation - in production you'd use a proper geocoding service
  // For now, use a basic city mapping
  const cities = [
    { name: "windhoek", bounds: { minLat: -22.7, maxLat: -22.4, minLng: 17.0, maxLng: 17.2 } },
    { name: "swakopmund", bounds: { minLat: -22.8, maxLat: -22.6, minLng: 14.4, maxLng: 14.6 } },
    { name: "walvis-bay", bounds: { minLat: -22.9, maxLat: -22.8, minLng: 14.4, maxLng: 14.6 } }
  ];

  for (const city of cities) {
    if (lat >= city.bounds.minLat && lat <= city.bounds.maxLat &&
        lng >= city.bounds.minLng && lng <= city.bounds.maxLng) {
      return city.name;
    }
  }

  return "windhoek"; // Default fallback
}