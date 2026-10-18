// Shared domain types for the Emergency Ambulance Route Optimization System.

export interface LatLng {
  lat: number;
  lng: number;
}

export interface Hospital {
  id: string;
  name: string;
  address?: string;
  lat: number;
  lng: number;
  manual?: boolean;
}

export interface RouteSegment {
  lat: number;
  lng: number;
}

export interface RouteResult {
  /** Straight-line source label, e.g. "Ambulance" */
  source: string;
  /** Straight-line destination label, e.g. hospital name or "Patient" */
  destination: string;
  /** Decoded polyline of the road route (OSRM geometry) */
  coordinates: RouteSegment[];
  /** Distance in meters reported by the routing service */
  distanceMeters: number;
  /** Duration in seconds reported by the routing service */
  durationSeconds: number;
  /** Free-text status: "success" | "unavailable" etc. */
  status: RouteStatus;
  /** Optional human-readable error message */
  message?: string;
}

export type RouteStatus =
  | "success"
  | "unavailable"
  | "no-route"
  | "error";

export interface HospitalRoute extends RouteResult {
  hospital: Hospital;
}

export interface AmbulanceState {
  location: LatLng | null;
  label: string;
}

export interface PatientState {
  location: LatLng | null;
  label: string;
}
