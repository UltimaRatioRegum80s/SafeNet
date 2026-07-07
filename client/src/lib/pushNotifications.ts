// Push notification client utilities for NaborNet

// Import incident types - fallback if import fails
const INCIDENT_TYPES = [
  { id: "accident", label: "Car Accident" },
  { id: "alarm", label: "Emergency Alarm" },
  { id: "break-in", label: "Break In/Burglary" },
  { id: "construction", label: "Construction Work" },
  { id: "fire", label: "Fire Emergency" },
  { id: "help", label: "SOS/Need Help" },
  { id: "pet", label: "Lost Pet" },
  { id: "suspicious", label: "Suspicious Person" },
  { id: "hit-run", label: "Hit & Run" },
  { id: "traffic", label: "Traffic Issue" },
  { id: "lost-found", label: "Lost & Found" },
  { id: "violence", label: "Violence/Fight" }
];

export interface PushSubscriptionData {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
  neighbourhoodId: string;
  types: string[];
}

// Convert VAPID public key to Uint8Array
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

// Format subscription for API
function formatSubscription(subscription: PushSubscription): Omit<PushSubscriptionData, 'neighbourhoodId' | 'types'> {
  const keys = subscription.getKey ? {
    p256dh: arrayBufferToBase64(subscription.getKey('p256dh')!),
    auth: arrayBufferToBase64(subscription.getKey('auth')!)
  } : { p256dh: '', auth: '' };

  return {
    endpoint: subscription.endpoint,
    keys
  };
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}

export class PushNotificationManager {
  private vapidPublicKey: string;
  private registration: ServiceWorkerRegistration | null = null;

  constructor() {
    // Default VAPID public key - should be in environment variable
    this.vapidPublicKey = import.meta.env.VITE_VAPID_PUBLIC || 
      'BLVHp22wYxnXnegSKvbeUVMymhM06k-fptGnLvJJPn-H2_gbYnR2IFTffKLPq4b0W80oWBj693o4J17jH7eKGJU';
  }

  async initialize(): Promise<boolean> {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      console.warn('📱 Push notifications not supported');
      return false;
    }

    try {
      this.registration = await navigator.serviceWorker.register('/sw.js');
      console.log('✅ Service Worker registered');
      return true;
    } catch (error) {
      console.error('❌ Service Worker registration failed:', error);
      return false;
    }
  }

  async requestPermission(): Promise<NotificationPermission> {
    if (!('Notification' in window)) {
      console.warn('📱 Notifications not supported');
      return 'denied';
    }

    const permission = await Notification.requestPermission();
    console.log(`🔔 Notification permission: ${permission}`);
    return permission;
  }

  async subscribe(neighbourhoodId: string, types: string[] = []): Promise<boolean> {
    if (!this.registration) {
      console.error('❌ Service Worker not registered');
      return false;
    }

    try {
      const permission = await this.requestPermission();
      if (permission !== 'granted') {
        console.warn('❌ Notification permission denied');
        return false;
      }

      const subscription = await this.registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(this.vapidPublicKey)
      });

      const subscriptionData: PushSubscriptionData = {
        ...formatSubscription(subscription),
        neighbourhoodId,
        types
      };

      const response = await fetch('/api/push/subscribe', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(subscriptionData)
      });

      if (!response.ok) {
        throw new Error(`Subscription failed: ${response.statusText}`);
      }

      console.log('✅ Push subscription successful');
      localStorage.setItem('pushSubscribed', 'true');
      localStorage.setItem('pushTypes', JSON.stringify(types));
      return true;
    } catch (error) {
      console.error('❌ Push subscription failed:', error);
      return false;
    }
  }

  async unsubscribe(): Promise<boolean> {
    if (!this.registration) return false;

    try {
      const subscription = await this.registration.pushManager.getSubscription();
      if (!subscription) return true;

      await subscription.unsubscribe();

      await fetch('/api/push/subscribe', {
        method: 'DELETE',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpoint: subscription.endpoint })
      });

      console.log('✅ Push unsubscription successful');
      localStorage.removeItem('pushSubscribed');
      localStorage.removeItem('pushTypes');
      return true;
    } catch (error) {
      console.error('❌ Push unsubscription failed:', error);
      return false;
    }
  }

  async updateSettings(types: string[]): Promise<boolean> {
    if (!this.registration) return false;

    try {
      const subscription = await this.registration.pushManager.getSubscription();
      if (!subscription) return false;

      const response = await fetch('/api/push/settings', {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          endpoint: subscription.endpoint, 
          types 
        })
      });

      if (!response.ok) {
        throw new Error(`Settings update failed: ${response.statusText}`);
      }

      console.log('✅ Push settings updated');
      localStorage.setItem('pushTypes', JSON.stringify(types));
      return true;
    } catch (error) {
      console.error('❌ Push settings update failed:', error);
      return false;
    }
  }

  async sendTestNotification(): Promise<boolean> {
    if (!('Notification' in window)) return false;

    try {
      const permission = await this.requestPermission();
      if (permission !== 'granted') return false;

      new Notification('🧪 NaborNet Test', {
        body: 'Push notifications are working correctly!',
        icon: '/icons/icon-192.png',
        tag: 'test-notification'
      });

      return true;
    } catch (error) {
      console.error('❌ Test notification failed:', error);
      return false;
    }
  }

  isSubscribed(): boolean {
    return localStorage.getItem('pushSubscribed') === 'true';
  }

  getSubscribedTypes(): string[] {
    try {
      return JSON.parse(localStorage.getItem('pushTypes') || '[]');
    } catch {
      return [];
    }
  }

  getAvailableTypes() {
    return INCIDENT_TYPES.map((type: any) => ({
      id: type.id,
      label: type.label,
      description: `Get notified about ${type.label.toLowerCase()} incidents`
    }));
  }
}

export const pushManager = new PushNotificationManager();