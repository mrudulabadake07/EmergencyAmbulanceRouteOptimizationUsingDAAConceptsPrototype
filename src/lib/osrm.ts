// Wrapper around the public OSRM routing API.
//
// OSRM returns real road routes with distance (meters) and duration (seconds).
// The server is public and may have rate limits / downtime — all failures are
// surfaced as a RouteResult with status "unavailable" or "no-route" so the UI
// can show a clear message instead of inventing numbers.

import type { LatLng, RouteResult, RouteSegment, RouteStatus } from "./types";

// Public OSRM demo server. Free for light, non-commercial demo use.
const OSRM_BASE = "https://router.project-osrm.org";

interface OSRMRouteResponse {
  code: string;
  routes?: {
    distance: number; // meters
    duration: number; // seconds
    geometry: {
      coordinates: [number, number][]; // [lng, lat] pairs
      type: string;
    };
  }[];
}

function statusFromCode(code: string): RouteStatus {
  if (code === "Ok") return "success";
  if (code === "NoRoute") return "no-route";
  return "unavailable";
}

/**
 * Request a single road route from `from` to `to`.
 * `source` and `destination` are plain-text labels for the RouteResult.
 */
export async function getRoute(
  from: LatLng,
  to: LatLng,
  source: string,
  destination: string,
): Promise<RouteResult> {
  const url =
    `${OSRM_BASE}/route/v1/driving/` +
    `${from.lng},${from.lat};${to.lng},${to.lat}` +
    `?overview=full&geometries=geojson&alternatives=false&steps=false`;

  try {
    const res = await fetch(url);
    if (!res.ok) {
      return {
        source,
        destination,
        coordinates: [],
        distanceMeters: 0,
        durationSeconds: 0,
        status: "unavailable",
        message: `Routing service returned HTTP ${res.status}.`,
      };
    }
    const data = (await res.json()) as OSRMRouteResponse;
    const status = statusFromCode(data.code ?? "");
    const route = data.routes?.[0];

    if (!route || status !== "success") {
      return {
        source,
        destination,
        coordinates: [],
        distanceMeters: 0,
        durationSeconds: 0,
        status,
        message:
          status === "no-route"
            ? "No road route found between these points."
            : "Routing service did not return a route.",
      };
    }

    const coordinates: RouteSegment[] = route.geometry.coordinates.map(
      ([lng, lat]) => ({ lat, lng }),
    );

    return {
      source,
      destination,
      coordinates,
      distanceMeters: route.distance,
      durationSeconds: route.duration,
      status: "success",
    };
  } catch (err) {
    return {
      source,
      destination,
      coordinates: [],
      distanceMeters: 0,
      durationSeconds: 0,
      status: "unavailable",
      message:
        err instanceof Error
          ? `Could not reach the routing service: ${err.message}`
          : "Could not reach the routing service.",
    };
  }
}

/** Format meters as a human-friendly distance string. */
export function formatDistance(meters: number): string {
  if (meters >= 1000) return `${(meters / 1000).toFixed(2)} km`;
  return `${Math.round(meters)} m`;
}

/** Format seconds as X min Y s (or H h M min for long routes). */
export function formatDuration(seconds: number): string {
  const total = Math.round(seconds);
  if (total < 60) return `${total} s`;
  const mins = Math.floor(total / 60);
  const secs = total % 60;
  if (mins < 60) return `${mins} min ${secs} s`;
  const hrs = Math.floor(mins / 60);
  const remMin = mins % 60;
  return `${hrs} h ${remMin} min`;
}
