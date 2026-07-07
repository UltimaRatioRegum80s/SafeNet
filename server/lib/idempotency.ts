/**
 * In-memory idempotency support for NaborNet (Phase 1)
 * Prevents duplicate submissions without requiring Redis
 * Will be upgraded to Redis-backed in Phase 2
 */

import { CONFIG } from "./dedupe";

// In-memory store for idempotency keys
const idempotencyStore = new Map<string, { timestamp: number; result?: any }>();

// Cleanup old idempotency keys periodically
const CLEANUP_INTERVAL = 300000; // 5 minutes
setInterval(() => {
  const now = Date.now();
  const ttlMs = CONFIG.IDEMPOTENCY_TTL_SEC * 1000;
  
  const entries = Array.from(idempotencyStore.entries());
  for (const [key, entry] of entries) {
    if (now - entry.timestamp > ttlMs) {
      idempotencyStore.delete(key);
    }
  }
}, CLEANUP_INTERVAL);

/**
 * Check if an idempotency key has been used recently
 * @param key - Idempotency key from client
 * @returns true if this is a new request, false if duplicate
 */
export function assertIdempotency(key?: string): boolean {
  if (!key) return true; // No idempotency key provided
  
  const now = Date.now();
  const ttlMs = CONFIG.IDEMPOTENCY_TTL_SEC * 1000;
  const existing = idempotencyStore.get(key);
  
  if (existing && (now - existing.timestamp) < ttlMs) {
    return false; // Duplicate request within TTL
  }
  
  // Store the key with current timestamp
  idempotencyStore.set(key, { timestamp: now });
  return true; // New request
}

/**
 * Store the result of an idempotent operation
 * @param key - Idempotency key
 * @param result - Result to cache
 */
export function storeIdempotencyResult(key: string, result: any): void {
  const existing = idempotencyStore.get(key);
  if (existing) {
    existing.result = result;
  }
}

/**
 * Get cached result for an idempotency key
 * @param key - Idempotency key
 * @returns cached result or undefined
 */
export function getIdempotencyResult(key?: string): any {
  if (!key) return undefined;
  return idempotencyStore.get(key)?.result;
}

/**
 * Get current store size (for monitoring)
 */
export function getIdempotencyStoreSize(): number {
  return idempotencyStore.size;
}