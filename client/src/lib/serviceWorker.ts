import { clearAllOfflineData } from './offlineDb';

// ============================================================================
// DEPLOYMENT TRUTH MODE: SERVICE WORKER COMPLETELY DISABLED
// This file now ONLY unregisters existing SWs and clears caches.
// No registration will occur until deployment truth is restored.
// ============================================================================

let swRegistration: ServiceWorkerRegistration | null = null;

export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  console.log('[SW] ⚠️ SERVICE WORKER DISABLED FOR DEPLOYMENT DEBUGGING');
  
  // STEP 1: Unregister ALL existing service workers
  if ('serviceWorker' in navigator) {
    try {
      const registrations = await navigator.serviceWorker.getRegistrations();
      console.log(`[SW] Found ${registrations.length} existing registrations to unregister`);
      for (const reg of registrations) {
        await reg.unregister();
        console.log('[SW] Unregistered:', reg.scope);
      }
    } catch (e) {
      console.error('[SW] Error unregistering:', e);
    }
  }
  
  // STEP 2: Clear ALL caches
  if ('caches' in window) {
    try {
      const cacheNames = await caches.keys();
      console.log(`[SW] Found ${cacheNames.length} caches to delete:`, cacheNames);
      for (const name of cacheNames) {
        await caches.delete(name);
        console.log('[SW] Deleted cache:', name);
      }
    } catch (e) {
      console.error('[SW] Error clearing caches:', e);
    }
  }
  
  console.log('[SW] ✅ All service workers unregistered, all caches cleared');
  console.log('[SW] ❌ NOT registering new service worker - deployment debug mode');
  
  return null; // Do NOT register any service worker
}

export async function clearCachesOnLogout(): Promise<void> {
  console.log('[SW] Clearing caches on logout');
  
  await clearAllOfflineData();
  
  const controller = navigator.serviceWorker.controller;
  if (controller) {
    return new Promise((resolve) => {
      const messageChannel = new MessageChannel();
      
      messageChannel.port1.onmessage = (event) => {
        if (event.data?.success) {
          console.log('[SW] Caches cleared successfully');
        }
        resolve();
      };
      
      controller.postMessage(
        { type: 'CLEAR_CACHES' },
        [messageChannel.port2]
      );
      
      setTimeout(resolve, 2000);
    });
  }
  
  if ('caches' in window) {
    const cacheNames = await caches.keys();
    await Promise.all(
      cacheNames
        .filter(name => name.startsWith('nabornet-'))
        .map(name => caches.delete(name))
    );
    console.log('[SW] Caches cleared directly');
  }
}

export function skipWaiting(): void {
  if (navigator.serviceWorker.controller) {
    navigator.serviceWorker.controller.postMessage({ type: 'SKIP_WAITING' });
  }
}

let updateCallback: ((waitingWorker: ServiceWorker) => void) | null = null;
let waitingWorkerRef: ServiceWorker | null = null;

export function onUpdateAvailable(callback: (waitingWorker: ServiceWorker) => void): void {
  updateCallback = callback;
  if (waitingWorkerRef) {
    callback(waitingWorkerRef);
  }
}

function notifyUpdateAvailable(waitingWorker: ServiceWorker): void {
  waitingWorkerRef = waitingWorker;
  if (updateCallback) {
    updateCallback(waitingWorker);
  }
}

export function getRegistration(): ServiceWorkerRegistration | null {
  return swRegistration;
}

export async function unregisterServiceWorker(): Promise<boolean> {
  if (swRegistration) {
    const success = await swRegistration.unregister();
    if (success) {
      swRegistration = null;
      console.log('[SW] Service worker unregistered');
    }
    return success;
  }
  return false;
}
