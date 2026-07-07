export function timeAgo(input?: number | string | Date) {
  if (input == null) return "Just now";
  let d: Date;
  if (input instanceof Date) d = input;
  else if (typeof input === "number") d = new Date(input < 1e12 ? input * 1000 : input);
  else d = new Date(input);
  if (Number.isNaN(d.getTime())) return "Unknown time";

  const s = Math.floor((Date.now() - d.getTime()) / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const dys = Math.floor(h / 24);
  return `${dys}d ago`;
}