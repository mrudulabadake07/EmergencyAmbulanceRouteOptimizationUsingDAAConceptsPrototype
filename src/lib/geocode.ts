// Geocoding via the public Nominatim (OpenStreetMap) service.
//
// Used to turn a typed address into lat/lng coordinates, and to reverse-geocode
// a clicked map point into a readable label. Nominatim is free but rate-limited;
// failures are surfaced as a clear message rather than silently ignored.

import type { LatLng } from "./types";

const NOMINATIM_BASE = "https://nominatim.openstreetmap.org";

export interface GeocodeResult {
  lat: number;
  lng: number;
  displayName: string;
}

/**
 * Forward geocode: address text -> coordinates.
 * Returns null when nothing is found or the service is unreachable.
 */
export async function geocodeAddress(query: string): Promise<GeocodeResult | null> {
  const url =
    `${NOMINATIM_BASE}/search?format=jsonv2&limit=1&q=` +
    encodeURIComponent(query);

  try {
    const res = await fetch(url, {
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as Array<{
      lat: string;
      lon: string;
      display_name: string;
    }>;
    if (!data.length) return null;
    const hit = data[0];
    return {
      lat: parseFloat(hit.lat),
      lng: parseFloat(hit.lon),
      displayName: hit.display_name,
    };
  } catch {
    return null;
  }
}

/**
 * Reverse geocode: coordinates -> a readable place name.
 * Returns null when the service is unreachable or has nothing for the point.
 */
export async function reverseGeocode(point: LatLng): Promise<string | null> {
  const url =
    `${NOMINATIM_BASE}/reverse?format=jsonv2&lat=${point.lat}&lon=${point.lng}`;

  try {
    const res = await fetch(url, {
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { display_name?: string };
    return data.display_name ?? null;
  } catch {
    return null;
  }
}
