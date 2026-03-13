export type LonLat = { lon: number; lat: number };

export function parsePointWKT(s: string): LonLat | null {
  // "POINT (-122.30253 47.72656)"
  if (!s) return null;
  const m = s.match(/POINT\s*\(\s*([-\d.]+)\s+([-\d.]+)\s*\)/i);
  if (!m) return null;
  const lon = Number(m[1]);
  const lat = Number(m[2]);
  if (!Number.isFinite(lon) || !Number.isFinite(lat)) return null;
  return { lon, lat };
}

export function toNumber(v: any): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}