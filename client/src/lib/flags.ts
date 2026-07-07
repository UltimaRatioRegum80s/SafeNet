export function readFlag(name: string, def = '0') {
  const url = new URL(location.href);
  const q = url.searchParams.get(name);
  if (q === '1' || q === '0') return q;
  const ls = localStorage.getItem(name);
  if (ls === '1' || ls === '0') return ls;
  return def;
}

export const Flags = {
  fixMobileMarkers: readFlag('NN_FIX_MOBILE_MARKERS', '0') === '1',
};