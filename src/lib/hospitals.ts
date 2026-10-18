// Hospital discovery and sample data.
//
// Automatic discovery uses the public Overpass API to query OpenStreetMap for
// hospitals (`amenity=hospital`) within a bounding box or radius. Multiple
// Overpass mirror endpoints are tried in order for reliability. If all mirrors
// are unavailable, the user can always add hospitals manually.

import type { Hospital, LatLng } from "./types";

// Multiple Overpass mirrors — tried in order until one responds.
const OVERPASS_ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass.openstreetmap.fr/api/interpreter",
];

interface OverpassElement {
  id: number;
  type: "node" | "way" | "relation";
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

async function queryOverpass(query: string): Promise<OverpassElement[]> {
  let lastErr: Error | null = null;
  for (const url of OVERPASS_ENDPOINTS) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: "data=" + encodeURIComponent(query),
        signal: AbortSignal.timeout(15000),
      });
      if (!res.ok) {
        lastErr = new Error(`Overpass (${url}) returned HTTP ${res.status}`);
        continue;
      }
      const data = (await res.json()) as { elements: OverpassElement[] };
      return data.elements;
    } catch (err) {
      lastErr = err instanceof Error ? err : new Error(String(err));
      // try next mirror
    }
  }
  throw lastErr ?? new Error("All Overpass mirrors failed");
}

function elementsToHospitals(elements: OverpassElement[], limit: number): Hospital[] {
  const hospitals: Hospital[] = [];
  for (const el of elements) {
    let lat: number | undefined = el.lat;
    let lng: number | undefined = el.lon;
    if (lat === undefined || lng === undefined) {
      if (el.center) {
        lat = el.center.lat;
        lng = el.center.lon;
      }
    }
    if (lat === undefined || lng === undefined) continue;

    const rawName =
      el.tags?.name ??
      el.tags?.["name:en"] ??
      el.tags?.operator ??
      null;

    // Determine facility type label for unnamed facilities.
    const amenity = el.tags?.amenity;
    const healthcare = el.tags?.healthcare;
    const typeLabel =
      amenity === "hospital" || healthcare === "hospital"
        ? "Hospital"
        : amenity === "clinic" || healthcare === "clinic"
          ? "Clinic"
          : healthcare === "centre"
            ? "Health Centre"
            : amenity === "doctors"
              ? "Doctor"
              : "Medical Facility";

    const name = rawName ?? `Unnamed ${typeLabel}`;

    hospitals.push({
      id: `osm-${el.type}-${el.id}`,
      name,
      address: el.tags?.["addr:full"] ?? el.tags?.["addr:city"],
      lat,
      lng,
    });
    if (hospitals.length >= limit) break;
  }
  return hospitals;
}

/**
 * Query Overpass for all medical facilities within a bounding box (the visible
 * map area). This includes hospitals, clinics, health centres, and other
 * healthcare amenity types so the map is rich with facilities everywhere.
 *
 * If the bounding box is very large (zoomed far out), it is split into a grid
 * of smaller tiles queried in sequence — a single huge bbox would make
 * Overpass time out.
 *
 * Returns at most `limit` facilities. Throws on network/server errors.
 */
export async function discoverHospitalsInBounds(
  south: number,
  west: number,
  north: number,
  east: number,
  limit = 200,
): Promise<Hospital[]> {
  // If the bbox spans more than ~0.5 degrees, split into tiles.
  const latSpan = north - south;
  const lngSpan = east - west;
  const tiles: { s: number; w: number; n: number; e: number }[] = [];
  if (latSpan > 0.5 || lngSpan > 0.5) {
    const latStep = Math.min(0.5, latSpan / Math.ceil(latSpan / 0.5));
    const lngStep = Math.min(0.5, lngSpan / Math.ceil(lngSpan / 0.5));
    for (let ls = south; ls < north - 1e-6; ls += latStep) {
      for (let lw = west; lw < east - 1e-6; lw += lngStep) {
        tiles.push({
          s: ls,
          w: lw,
          n: Math.min(ls + latStep, north),
          e: Math.min(lw + lngStep, east),
        });
      }
    }
  } else {
    tiles.push({ s: south, w: west, n: north, e: east });
  }

  const all: Hospital[] = [];
  const seenIds = new Set<string>();
  for (const t of tiles) {
    if (all.length >= limit) break;
    const query = `
      [out:json][timeout:25];
      (
        node["amenity"="hospital"](${t.s},${t.w},${t.n},${t.e});
        way["amenity"="hospital"](${t.s},${t.w},${t.n},${t.e});
        node["amenity"="clinic"](${t.s},${t.w},${t.n},${t.e});
        way["amenity"="clinic"](${t.s},${t.w},${t.n},${t.e});
        node["healthcare"="hospital"](${t.s},${t.w},${t.n},${t.e});
        way["healthcare"="hospital"](${t.s},${t.w},${t.n},${t.e});
        node["healthcare"="clinic"](${t.s},${t.w},${t.n},${t.e});
        way["healthcare"="clinic"](${t.s},${t.w},${t.n},${t.e});
        node["healthcare"="centre"](${t.s},${t.w},${t.n},${t.e});
        way["healthcare"="centre"](${t.s},${t.w},${t.n},${t.e});
        node["amenity"="doctors"](${t.s},${t.w},${t.n},${t.e});
        way["amenity"="doctors"](${t.s},${t.w},${t.n},${t.e});
      );
      out center 300;
    `;
    try {
      const elements = await queryOverpass(query);
      const tileHospitals = elementsToHospitals(elements, limit);
      for (const h of tileHospitals) {
        if (seenIds.has(h.id)) continue;
        seenIds.add(h.id);
        all.push(h);
        if (all.length >= limit) break;
      }
    } catch {
      // If one tile fails, continue with the rest.
    }
  }
  return all;
}

/**
 * Query Overpass for hospitals near `center` within `radiusM` meters.
 * Returns at most `limit` hospitals. Throws on network/server errors so the
 * caller can surface a clear "discovery unavailable" message.
 */
export async function discoverHospitals(
  center: LatLng,
  radiusM = 7000,
  limit = 12,
): Promise<Hospital[]> {
  const query = `
    [out:json][timeout:25];
    (
      node["amenity"="hospital"](around:${radiusM},${center.lat},${center.lng});
      way["amenity"="hospital"](around:${radiusM},${center.lat},${center.lng});
    );
    out center 80;
  `;
  const elements = await queryOverpass(query);
  return elementsToHospitals(elements, limit);
}

// ---------------------------------------------------------------------------
// Sample demonstration data (clearly labelled as demo data in the UI).
// Coordinates are real places so OSRM can route between them.
// ---------------------------------------------------------------------------

export const SAMPLE_AMBULANCE: LatLng & { label: string } = {
  lat: 12.9716,
  lng: 77.5946,
  label: "MG Road, Bengaluru (sample ambulance)",
};

export const SAMPLE_PATIENT: LatLng & { label: string } = {
  lat: 12.9352,
  lng: 77.6245,
  label: "Indiranagar, Bengaluru (sample patient)",
};

export const SAMPLE_HOSPITALS: Hospital[] = [
  {
    id: "sample-h1",
    name: "Manipal Hospital (sample)",
    lat: 12.9172,
    lng: 77.6224,
    manual: false,
  },
  {
    id: "sample-h2",
    name: "Fortis Hospital (sample)",
    lat: 12.9098,
    lng: 77.6019,
    manual: false,
  },
  {
    id: "sample-h3",
    name: "Apollo Hospital (sample)",
    lat: 12.9279,
    lng: 77.5786,
    manual: false,
  },
  {
    id: "sample-h4",
    name: "Columbia Asia (sample)",
    lat: 12.9698,
    lng: 77.7499,
    manual: false,
  },
];
