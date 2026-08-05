import fs from "node:fs";
import path from "node:path";

// The Nocny Zew Wilka track. The file under public/ is what runners download,
// and the drawings on the event page are derived from that very same file at
// build time — so the map, the numbers and the GPX can never drift apart.
export const GPX_PUBLIC_PATH = "/zewwilka/nocny-zew-wilka-10km.gpx";

const MAP_BOX = 420; // longest side of the route drawing, in SVG units
const PROFILE_W = 640;
const PROFILE_H = 180;

interface Point {
  lat: number;
  lon: number;
  ele: number;
}

export interface RouteGeometry {
  distanceKm: number;
  elevationGainM: number;
  minEleM: number;
  maxEleM: number;
  /** Route outline as an SVG path, drawn inside mapWidth x mapHeight. */
  mapPath: string;
  mapWidth: number;
  mapHeight: number;
  /** Start/finish marker in map coordinates (start and finish are the same spot). */
  startX: number;
  startY: number;
  /** Elevation profile line + the area beneath it, in PROFILE_W x PROFILE_H. */
  profilePath: string;
  profileAreaPath: string;
  profileWidth: number;
  profileHeight: number;
}

function parseGpx(xml: string): Point[] {
  const re = /<rtept lat="([\d.-]+)" lon="([\d.-]+)"><ele>([\d.-]+)<\/ele>/g;
  const points: Point[] = [];
  for (const m of xml.matchAll(re)) {
    points.push({ lat: Number(m[1]), lon: Number(m[2]), ele: Number(m[3]) });
  }
  return points;
}

/** Great-circle distance in metres. */
function haversine(a: Point, b: Point): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/**
 * Ramer–Douglas–Peucker. A raw GPS track is ~3700 points; inlining all of them
 * would bloat the HTML for a shape nobody can tell apart from its simplified
 * twin at 420px wide.
 */
function simplify(pts: [number, number][], tolerance: number): [number, number][] {
  if (pts.length < 3) return pts;

  const [x1, y1] = pts[0];
  const [x2, y2] = pts[pts.length - 1];
  const dx = x2 - x1;
  const dy = y2 - y1;
  const segLen = Math.hypot(dx, dy);

  let maxDist = -1;
  let index = 0;
  for (let i = 1; i < pts.length - 1; i++) {
    const [px, py] = pts[i];
    const dist =
      segLen === 0
        ? Math.hypot(px - x1, py - y1)
        : Math.abs(dy * px - dx * py + x2 * y1 - y2 * x1) / segLen;
    if (dist > maxDist) {
      maxDist = dist;
      index = i;
    }
  }

  if (maxDist <= tolerance) return [pts[0], pts[pts.length - 1]];
  return [
    ...simplify(pts.slice(0, index + 1), tolerance).slice(0, -1),
    ...simplify(pts.slice(index), tolerance),
  ];
}

const toPath = (pts: [number, number][]) =>
  pts.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`).join("");

export function loadRouteGeometry(): RouteGeometry {
  const xml = fs.readFileSync(path.join(process.cwd(), "public", GPX_PUBLIC_PATH), "utf8");
  const pts = parseGpx(xml);

  let distance = 0;
  let gain = 0;
  const cumulative: number[] = [0];
  for (let i = 1; i < pts.length; i++) {
    distance += haversine(pts[i - 1], pts[i]);
    cumulative.push(distance);
    gain += Math.max(0, pts[i].ele - pts[i - 1].ele);
  }

  const lats = pts.map((p) => p.lat);
  const lons = pts.map((p) => p.lon);
  const eles = pts.map((p) => p.ele);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLon = Math.min(...lons);
  const maxLon = Math.max(...lons);
  const minEle = Math.min(...eles);
  const maxEle = Math.max(...eles);

  // Equirectangular projection; at this scale (a few km) it is indistinguishable
  // from anything fancier. Longitudes shrink by cos(lat) to keep the shape true.
  const lonScale = Math.cos(((minLat + maxLat) / 2) * (Math.PI / 180));
  const spanX = (maxLon - minLon) * lonScale;
  const spanY = maxLat - minLat;
  const scale = MAP_BOX / Math.max(spanX, spanY);
  const mapWidth = Math.round(spanX * scale);
  const mapHeight = Math.round(spanY * scale);

  const project = (p: Point): [number, number] => [
    (p.lon - minLon) * lonScale * scale,
    (maxLat - p.lat) * scale,
  ];

  const projected = pts.map(project);
  const mapPath = toPath(simplify(projected, MAP_BOX / 2000));
  const [startX, startY] = projected[0];

  const profilePoints: [number, number][] = pts.map((p, i) => [
    (cumulative[i] / distance) * PROFILE_W,
    PROFILE_H - ((p.ele - minEle) / (maxEle - minEle)) * PROFILE_H,
  ]);
  const profile = simplify(profilePoints, 0.6);
  const profilePath = toPath(profile);

  return {
    distanceKm: Math.round((distance / 1000) * 10) / 10,
    elevationGainM: Math.round(gain),
    minEleM: Math.round(minEle),
    maxEleM: Math.round(maxEle),
    mapPath,
    mapWidth,
    mapHeight,
    startX: Math.round(startX * 10) / 10,
    startY: Math.round(startY * 10) / 10,
    profilePath,
    profileAreaPath: `${profilePath}L${PROFILE_W} ${PROFILE_H}L0 ${PROFILE_H}Z`,
    profileWidth: PROFILE_W,
    profileHeight: PROFILE_H,
  };
}
