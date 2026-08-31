export interface GeoPoint {
  latitude: number;
  longitude: number;
}

/**
 * Ray-casting point-in-polygon test — used to check a stray-cat report's
 * location against its reporting map's admin-drawn boundary. Treats the
 * polygon as implicitly closed (no need for the caller to repeat the first
 * point at the end). Fine for the small, hand-drawn polygons this app
 * deals with; not meant for large geometries.
 */
export function isPointInPolygon(point: GeoPoint, polygon: GeoPoint[]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const pi = polygon[i]!;
    const pj = polygon[j]!;
    const intersects =
      pi.latitude > point.latitude !== pj.latitude > point.latitude &&
      point.longitude <
        ((pj.longitude - pi.longitude) * (point.latitude - pi.latitude)) / (pj.latitude - pi.latitude) +
          pi.longitude;
    if (intersects) inside = !inside;
  }
  return inside;
}

/** Bounding box of a polygon — used to center/zoom a map on it. */
export function boundingBox(points: GeoPoint[]): { north: number; south: number; east: number; west: number } {
  return {
    north: Math.max(...points.map((p) => p.latitude)),
    south: Math.min(...points.map((p) => p.latitude)),
    east: Math.max(...points.map((p) => p.longitude)),
    west: Math.min(...points.map((p) => p.longitude)),
  };
}
