// Utilities for drag sheet functionality
export function snapTo(value: number, snaps: number[]) {
  let best = snaps[0], min = Infinity;
  for (const s of snaps) { 
    const d = Math.abs(value - s); 
    if (d < min) { 
      min = d; 
      best = s; 
    } 
  }
  return best;
}

export function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}