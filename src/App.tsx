import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Ambulance, Info, ShieldAlert, Truck, HeartPulse, Building2, CheckCircle2, Loader2 } from "lucide-react";
import MapView, { type MapBounds, type AnimationPhase } from "@/components/MapView";
import LocationPanel, { ActionButtons } from "@/components/LocationPanel";
import DashboardPanel, { HospitalList } from "@/components/DashboardPanel";
import HospitalPanel from "@/components/HospitalPanel";
import AlgorithmPanel from "@/components/AlgorithmPanel";
import { reverseGeocode } from "@/lib/geocode";
import { getRoute } from "@/lib/osrm";
import {
  discoverHospitals,
  discoverHospitalsInBounds,
  SAMPLE_AMBULANCE,
  SAMPLE_HOSPITALS,
  SAMPLE_PATIENT,
} from "@/lib/hospitals";
import type {
  Hospital,
  HospitalRoute,
  LatLng,
  RouteSegment,
  RouteStatus,
} from "@/lib/types";

// ---------------------------------------------------------------------------
// Main application: Emergency Ambulance Route Optimization System.
//
// Real road routes + travel times are fetched from the public OSRM service.
// Hospital selection (the "nearest hospital" recommendation) is a greedy
// selection over those travel times: pick the hospital with the smallest
// estimated duration. The Dijkstra / BFS algorithm demonstration lives in the
// AlgorithmPanel component and runs on a standalone demo graph — it is NOT
// claimed to produce the OSRM road routes.
// ---------------------------------------------------------------------------

const ALGORITHM_LABEL = "Dijkstra (demo) + Greedy selection";

function labelOf(point: LatLng | null, fallback: string): string {
  if (!point) return fallback;
  const coord = `${point.lat.toFixed(4)}, ${point.lng.toFixed(4)}`;
  return coord;
}

export default function App() {
  // --- Core state -----------------------------------------------------------
  const [ambulance, setAmbulance] = useState<LatLng | null>(null);
  const [ambulanceLabel, setAmbulanceLabel] = useState<string>("");
  const [patient, setPatient] = useState<LatLng | null>(null);
  const [patientLabel, setPatientLabel] = useState<string>("");
  const [clickMode, setClickMode] = useState<"ambulance" | "patient" | null>(null);

  const [hospitals, setHospitals] = useState<Hospital[]>([]);
  const [hospitalRoutes, setHospitalRoutes] = useState<HospitalRoute[]>([]);
  const [recommendedId, setRecommendedId] = useState<string | null>(null);
  const [selectedHospitalId, setSelectedHospitalId] = useState<string | null>(null);

  // ambulance -> patient route (the "Find Route" result)
  const [ambulanceToPatient, setAmbulanceToPatient] = useState<RouteSegment[] | null>(null);
  const [ambToPatientDistance, setAmbToPatientDistance] = useState<number | null>(null);
  const [ambToPatientDuration, setAmbToPatientDuration] = useState<number | null>(null);

  // active route to draw prominently (patient -> selected/recommended hospital)
  const [activeHospitalRoute, setActiveHospitalRoute] = useState<RouteSegment[] | null>(null);

  // Two separate legs for the ambulance animation so the patient pickup is
  // always the explicit boundary between them.
  const [legToPatient, setLegToPatient] = useState<RouteSegment[] | null>(null);
  const [legToHospital, setLegToHospital] = useState<RouteSegment[] | null>(null);
  // Bumping this number (re)starts the ambulance animation in MapView.
  const [animationKey, setAnimationKey] = useState(0);

  // status
  const [routeStatus, setRouteStatus] = useState<RouteStatus | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [isSampleData, setIsSampleData] = useState(false);

  // hospital discovery
  const [discovering, setDiscovering] = useState(false);
  const [discoveryError, setDiscoveryError] = useState<string | null>(null);

  // animation phase
  const [animPhase, setAnimPhase] = useState<AnimationPhase>("idle");

  // --- Derived recommended hospital -----------------------------------------
  const recommendedHospital: HospitalRoute | undefined = useMemo(
    () => hospitalRoutes.find((r) => r.hospital.id === recommendedId),
    [hospitalRoutes, recommendedId],
  );

  const selectedRoute: HospitalRoute | undefined = useMemo(
    () => hospitalRoutes.find((r) => r.hospital.id === selectedHospitalId),
    [hospitalRoutes, selectedHospitalId],
  );

  // What to show in the dashboard summary: prefer the selected route, else the recommended one.
  const summaryRoute = selectedRoute ?? recommendedHospital;

  // --- Location setters -----------------------------------------------------
  const handleSetAmbulance = useCallback((point: LatLng, label?: string) => {
    setAmbulance(point);
    setAmbulanceLabel(label ?? labelOf(point, "Ambulance location"));
    setIsSampleData(false);
  }, []);

  const handleSetPatient = useCallback((point: LatLng, label?: string) => {
    setPatient(point);
    setPatientLabel(label ?? labelOf(point, "Patient location"));
    setIsSampleData(false);
  }, []);

  const handleMapClick = useCallback(
    (point: LatLng) => {
      if (clickMode === "ambulance") {
        handleSetAmbulance(point);
        // reverse-geocode for a friendlier label (fire and forget)
        reverseGeocode(point).then((name) => {
          if (name) setAmbulanceLabel(name);
        });
      } else if (clickMode === "patient") {
        handleSetPatient(point);
        reverseGeocode(point).then((name) => {
          if (name) setPatientLabel(name);
        });
      }
    },
    [clickMode, handleSetAmbulance, handleSetPatient],
  );

  // --- Hospital management --------------------------------------------------
  const handleAddHospital = useCallback((h: Hospital) => {
    setHospitals((prev) => [...prev.filter((p) => p.id !== h.id), h]);
    setDiscoveryError(null);
  }, []);

  const handleRemoveHospital = useCallback((id: string) => {
    setHospitals((prev) => prev.filter((p) => p.id !== id));
    setHospitalRoutes((prev) => prev.filter((r) => r.hospital.id !== id));
    setRecommendedId((prev) => (prev === id ? null : prev));
    setSelectedHospitalId((prev) => (prev === id ? null : prev));
  }, []);

  const handleDiscoverHospitals = useCallback(
    async (center: LatLng) => {
      setDiscovering(true);
      setDiscoveryError(null);
      try {
        const found = await discoverHospitals(center);
        if (found.length === 0) {
          setDiscoveryError("No hospitals found nearby. Add one manually below.");
        }
        // Merge: keep manual ones, replace auto-discovered set.
        setHospitals((prev) => {
          const manual = prev.filter((h) => h.manual);
          return [...manual, ...found];
        });
      } catch (err) {
        setDiscoveryError(
          err instanceof Error
            ? `Auto-discovery failed: ${err.message}. You can add hospitals manually.`
            : "Auto-discovery failed. You can add hospitals manually.",
        );
      } finally {
        setDiscovering(false);
      }
    },
    [],
  );

  // --- Marker drag handler -------------------------------------------------
  const handleMarkerDrag = useCallback(
    (which: "ambulance" | "patient", point: LatLng) => {
      if (which === "ambulance") {
        setAmbulance(point);
        setAmbulanceLabel(labelOf(point, "Ambulance location"));
        setIsSampleData(false);
        reverseGeocode(point).then((name) => {
          if (name) setAmbulanceLabel(name);
        });
      } else {
        setPatient(point);
        setPatientLabel(labelOf(point, "Patient location"));
        setIsSampleData(false);
        reverseGeocode(point).then((name) => {
          if (name) setPatientLabel(name);
        });
      }
      // Clear stale routes when markers move
      setLegToPatient(null);
      setLegToHospital(null);
      setAnimationKey(0);
      setActiveHospitalRoute(null);
      setAmbulanceToPatient(null);
      setHospitalRoutes([]);
      setRecommendedId(null);
      setSelectedHospitalId(null);
      setRouteStatus(null);
      setStatusMessage(null);
    },
    [],
  );

  // --- Auto-discover hospitals in the visible map area ----------------------
  // Whenever the map is panned or zoomed, query Overpass for real hospitals
  // within the visible bounding box. Results are merged with manually-added
  // hospitals. A ref + debounce prevents duplicate/stale calls.
  const discoverBoundsRef = useRef(0);
  const handleMapBoundsChange = useCallback(
    (bounds: MapBounds) => {
      const reqId = ++discoverBoundsRef.current;
      setDiscovering(true);
      // Debounce: wait 600ms after the last pan/zoom before querying.
      window.setTimeout(async () => {
        if (reqId !== discoverBoundsRef.current) return; // superseded
        try {
          const found = await discoverHospitalsInBounds(
            bounds.south,
            bounds.west,
            bounds.north,
            bounds.east,
            200,
          );
          if (reqId !== discoverBoundsRef.current) return; // stale
          setHospitals((prev) => {
            const manual = prev.filter((h) => h.manual);
            return [...manual, ...found];
          });
          setDiscoveryError(null);
        } catch {
          if (reqId !== discoverBoundsRef.current) return;
          // Silently skip — the user can still add hospitals manually.
        } finally {
          if (reqId === discoverBoundsRef.current) {
            setDiscovering(false);
          }
        }
      }, 600);
    },
    [],
  );

  // --- Routing actions ------------------------------------------------------
  const validateInputs = (): { amb: LatLng; pat: LatLng } | null => {
    if (!ambulance) {
      setRouteStatus("error");
      setStatusMessage("Set the ambulance starting location first.");
      return null;
    }
    if (!patient) {
      setRouteStatus("error");
      setStatusMessage("Set the patient location first.");
      return null;
    }
    if (
      !isFinite(ambulance.lat) || !isFinite(ambulance.lng) ||
      !isFinite(patient.lat) || !isFinite(patient.lng)
    ) {
      setRouteStatus("error");
      setStatusMessage("Coordinates are invalid. Re-select the locations.");
      return null;
    }
    return { amb: ambulance, pat: patient };
  };

  // Find Route: the complete journey in one click.
  //   1. Ambulance -> patient (real OSRM road route)
  //   2. Discover hospitals on the map if none are loaded yet
  //   3. Find the nearest hospital to the patient (greedy min travel time)
  //   4. Animate: ambulance -> patient -> nearest hospital
  const handleFindRoute = useCallback(async () => {
    const inputs = validateInputs();
    if (!inputs) return;
    setLoading(true);
    setRouteStatus(null);
    setStatusMessage(null);
    setSelectedHospitalId(null);
    setActiveHospitalRoute(null);
    setLegToPatient(null);
    setLegToHospital(null);
    setAnimationKey(0);

    // Step 1: ambulance -> patient route.
    const ambToPatResult = await getRoute(
      inputs.amb,
      inputs.pat,
      "Ambulance",
      "Patient",
    );
    setAmbulanceToPatient(ambToPatResult.coordinates);
    setAmbToPatientDistance(ambToPatResult.status === "success" ? ambToPatResult.distanceMeters : null);
    setAmbToPatientDuration(ambToPatResult.status === "success" ? ambToPatResult.durationSeconds : null);

    if (ambToPatResult.status !== "success") {
      setLoading(false);
      setRouteStatus(ambToPatResult.status);
      setStatusMessage(ambToPatResult.message ?? null);
      return;
    }

    // Step 2: make sure we have hospitals. Auto-discover from the patient
    // location if the user hasn't added any yet. If discovery fails, fall
    // back to the built-in sample hospitals so the journey can still complete.
    let workingHospitals = hospitals;
    if (workingHospitals.length === 0) {
      setStatusMessage("Finding nearby hospitals on the map...");
      try {
        const found = await discoverHospitals(inputs.pat);
        if (found.length > 0) {
          workingHospitals = found;
          setHospitals(found);
        }
      } catch {
        // discovery failed — fall back to sample hospitals below
      }
      if (workingHospitals.length === 0) {
        workingHospitals = SAMPLE_HOSPITALS.map((h) => ({ ...h }));
        setHospitals(workingHospitals);
        setStatusMessage("Using sample hospitals — auto-discovery was unavailable.");
      }
    }

    if (workingHospitals.length === 0) {
      setLoading(false);
      setLegToPatient(ambToPatResult.coordinates);
      setLegToHospital(null);
      setAnimationKey((k) => k + 1);
      setRouteStatus("error");
      setStatusMessage(
        "No hospitals found on the map near the patient. Add hospitals manually below, then click Find Route again.",
      );
      return;
    }

    // Step 3: sort hospitals by straight-line distance to the patient and only
    // route the nearest 15 — routing hundreds of facilities would overwhelm
    // the OSRM service. The greedy min-duration selection runs on those.
    setStatusMessage(null);
    setHospitalRoutes([]);
    setRecommendedId(null);

    const nearest = [...workingHospitals]
      .map((h) => ({
        h,
        dist: Math.sqrt(
          Math.pow(h.lat - inputs.pat.lat, 2) +
          Math.pow(h.lng - inputs.pat.lng, 2),
        ),
      }))
      .sort((a, b) => a.dist - b.dist)
      .slice(0, 15)
      .map((x) => x.h);

    const hospitalResults = await Promise.all(
      nearest.map(async (h): Promise<HospitalRoute> => {
        const r = await getRoute(inputs.pat, { lat: h.lat, lng: h.lng }, "Patient", h.name);
        return { ...r, hospital: h };
      }),
    );

    setLoading(false);
    setHospitalRoutes(hospitalResults);

    const successful = hospitalResults.filter((r) => r.status === "success");
    if (successful.length === 0) {
      setRouteStatus("unavailable");
      setStatusMessage(
        "Could not compute a route to any hospital. The routing service may be unavailable.",
      );
      // Still animate ambulance -> patient even if hospital routing failed.
      setLegToPatient(ambToPatResult.coordinates);
      setLegToHospital(null);
      setAnimationKey((k) => k + 1);
      return;
    }

    const best = successful.reduce((min, r) =>
      r.durationSeconds < min.durationSeconds ? r : min,
    );
    setRecommendedId(best.hospital.id);
    setSelectedHospitalId(best.hospital.id);
    setActiveHospitalRoute(best.coordinates);
    setRouteStatus("success");
    setStatusMessage(null);

    // Step 4: pass the two separate legs to MapView so the ambulance
    // unambiguously goes to the patient first, then to the nearest hospital.
    setLegToPatient(ambToPatResult.coordinates);
    setLegToHospital(best.coordinates);
    setAnimationKey((k) => k + 1);
  }, [ambulance, patient, hospitals]);

  // Find Nearest Hospital: route from patient to each hospital, greedily pick min duration.
  // We route patient -> hospital because the ambulance first reaches the patient, then
  // transports the patient to the hospital. The recommendation compares the patient-to-hospital
  // leg across all hospitals. We also fetch ambulance -> patient so the full journey can be
  // animated on the map.
  const handleFindNearestHospital = useCallback(async () => {
    const inputs = validateInputs();
    if (!inputs) return;
    if (hospitals.length === 0) {
      setRouteStatus("error");
      setStatusMessage("No hospitals available. Add or discover hospitals first.");
      return;
    }
    setLoading(true);
    setRouteStatus(null);
    setStatusMessage(null);
    setHospitalRoutes([]);
    setRecommendedId(null);
    setSelectedHospitalId(null);
    setActiveHospitalRoute(null);
    setLegToPatient(null);
    setLegToHospital(null);
    setAnimationKey(0);

    // Sort by straight-line distance and route the 15 nearest to the patient.
    const nearest = [...hospitals]
      .map((h) => ({
        h,
        dist: Math.sqrt(
          Math.pow(h.lat - inputs.pat.lat, 2) +
          Math.pow(h.lng - inputs.pat.lng, 2),
        ),
      }))
      .sort((a, b) => a.dist - b.dist)
      .slice(0, 15)
      .map((x) => x.h);

    // Fetch ambulance -> patient and patient -> nearest 15 hospitals in parallel.
    const [ambToPatResult, ...hospitalResults] = await Promise.all([
      getRoute(inputs.amb, inputs.pat, "Ambulance", "Patient"),
      ...nearest.map(async (h): Promise<HospitalRoute> => {
        const r = await getRoute(inputs.pat, { lat: h.lat, lng: h.lng }, "Patient", h.name);
        return { ...r, hospital: h };
      }),
    ]);

    setLoading(false);

    // Show the ambulance -> patient leg as the secondary (dashed) route.
    setAmbulanceToPatient(ambToPatResult.coordinates);
    setAmbToPatientDistance(ambToPatResult.status === "success" ? ambToPatResult.distanceMeters : null);
    setAmbToPatientDuration(ambToPatResult.status === "success" ? ambToPatResult.durationSeconds : null);

    setHospitalRoutes(hospitalResults);

    // Greedy selection: among successfully evaluated hospitals, pick the one with
    // the smallest estimated travel time (duration). This is the "greedy" DAA concept.
    const successful = hospitalResults.filter((r) => r.status === "success");
    if (successful.length === 0) {
      setRouteStatus("unavailable");
      setStatusMessage(
        "Could not compute a route to any hospital. The routing service may be unavailable.",
      );
      return;
    }
    const best = successful.reduce((min, r) =>
      r.durationSeconds < min.durationSeconds ? r : min,
    );
    setRecommendedId(best.hospital.id);
    setSelectedHospitalId(best.hospital.id);
    setActiveHospitalRoute(best.coordinates);
    setRouteStatus("success");
    setStatusMessage(null);

    // Pass the two separate legs so the ambulance animates patient-pickup
    // first, then continues to the nearest hospital.
    if (ambToPatResult.status === "success" && best.coordinates.length > 1) {
      setLegToPatient(ambToPatResult.coordinates);
      setLegToHospital(best.coordinates);
      setAnimationKey((k) => k + 1);
    }
  }, [ambulance, patient, hospitals]);

  const handleSelectHospital = useCallback(
    (hospitalId: string) => {
      const r = hospitalRoutes.find((rr) => rr.hospital.id === hospitalId);
      setSelectedHospitalId(hospitalId);
      setActiveHospitalRoute(r?.coordinates ?? null);

      // Re-animate using the already-fetched ambulance->patient leg plus the
      // selected hospital's leg.
      if (r?.status === "success" && ambulanceToPatient && ambulanceToPatient.length > 1 && r.coordinates.length > 1) {
        setLegToPatient(ambulanceToPatient);
        setLegToHospital(r.coordinates);
        setAnimationKey((k) => k + 1);
      } else {
        setLegToPatient(null);
        setLegToHospital(null);
        setAnimationKey(0);
      }
    },
    [hospitalRoutes, ambulanceToPatient],
  );

  // --- Sample data ----------------------------------------------------------
  const handleSampleData = useCallback(() => {
    setAmbulance({ lat: SAMPLE_AMBULANCE.lat, lng: SAMPLE_AMBULANCE.lng });
    setAmbulanceLabel(SAMPLE_AMBULANCE.label);
    setPatient({ lat: SAMPLE_PATIENT.lat, lng: SAMPLE_PATIENT.lng });
    setPatientLabel(SAMPLE_PATIENT.label);
    setHospitals(SAMPLE_HOSPITALS.map((h) => ({ ...h })));
    setIsSampleData(true);
    // clear stale route output
    setHospitalRoutes([]);
    setRecommendedId(null);
    setSelectedHospitalId(null);
    setActiveHospitalRoute(null);
    setAmbulanceToPatient(null);
    setAmbToPatientDistance(null);
    setAmbToPatientDuration(null);
    setLegToPatient(null);
    setLegToHospital(null);
    setAnimationKey(0);
    setRouteStatus(null);
    setStatusMessage(null);
  }, []);

  const handleReset = useCallback(() => {
    setAmbulance(null);
    setAmbulanceLabel("");
    setPatient(null);
    setPatientLabel("");
    setHospitals([]);
    setHospitalRoutes([]);
    setRecommendedId(null);
    setSelectedHospitalId(null);
    setActiveHospitalRoute(null);
    setAmbulanceToPatient(null);
    setAmbToPatientDistance(null);
    setAmbToPatientDuration(null);
    setLegToPatient(null);
    setLegToHospital(null);
    setAnimationKey(0);
    setRouteStatus(null);
    setStatusMessage(null);
    setClickMode(null);
    setIsSampleData(false);
    setDiscoveryError(null);
  }, []);

  // Animation status banner content per phase
  const phaseInfo: Record<AnimationPhase, { text: string; color: string; icon: React.ReactNode }> = {
    idle: { text: "Ready to dispatch", color: "bg-gray-100 text-gray-600 border-gray-200", icon: <Truck size={14} /> },
    "to-patient": { text: "Ambulance en route to patient", color: "bg-red-50 text-red-700 border-red-200", icon: <Loader2 size={14} className="animate-spin" /> },
    pickup: { text: "Picking up patient", color: "bg-amber-50 text-amber-800 border-amber-200", icon: <HeartPulse size={14} /> },
    "to-hospital": { text: "Transporting patient to hospital", color: "bg-sky-50 text-sky-700 border-sky-200", icon: <Loader2 size={14} className="animate-spin" /> },
    arrived: { text: "Patient delivered to hospital", color: "bg-emerald-50 text-emerald-700 border-emerald-200", icon: <CheckCircle2 size={14} /> },
  };

  // --- Render ---------------------------------------------------------------
  const summaryDistance = summaryRoute?.status === "success"
    ? summaryRoute.distanceMeters
    : ambToPatientDistance;
  const summaryDuration = summaryRoute?.status === "success"
    ? summaryRoute.durationSeconds
    : ambToPatientDuration;
  const summaryHospitalName = summaryRoute?.hospital.name ?? null;

  return (
    <div className="flex min-h-screen flex-col bg-sky-50 text-gray-900">
      {/* Header */}
      <header className="sticky top-0 z-[1100] border-b border-sky-200 bg-gradient-to-r from-sky-700 to-sky-600 text-white shadow-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-2.5">
            <div className="rounded-lg bg-white/15 p-1.5">
              <Ambulance size={22} />
            </div>
            <div>
              <h1 className="text-base font-bold leading-tight sm:text-lg">
                Emergency Ambulance Route Optimization
              </h1>
              <p className="text-[11px] text-sky-100 sm:text-xs">
                Dijkstra &amp; greedy selection · DAA project prototype
              </p>
            </div>
          </div>
          {isSampleData && (
            <span className="rounded-full bg-amber-400 px-2.5 py-1 text-[11px] font-bold uppercase text-amber-950">
              Sample data
            </span>
          )}
        </div>
      </header>

      {/* Disclaimer */}
      <div className="mx-auto w-full max-w-7xl px-4 pt-3">
        <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          <ShieldAlert size={15} className="mt-0.5 shrink-0" />
          <p>
            This is an educational prototype. It does <b>not</b> contact real
            emergency services or dispatch ambulances. Public map, routing
            (OSRM), and geocoding services have limitations and may be
            unavailable; estimated times are advisory only and are not certified
            for real emergency response.
          </p>
        </div>
      </div>

      {/* Main layout: map + side panels */}
      <main className="mx-auto grid w-full max-w-7xl flex-1 grid-cols-1 gap-4 px-4 py-4 lg:grid-cols-[1fr_380px]">
        {/* Map column */}
        <div className="flex flex-col gap-3">
          <div className="relative h-[60vh] min-h-[340px] overflow-hidden rounded-2xl border border-sky-200 shadow-lg lg:h-[72vh]">
            <MapView
              ambulance={ambulance}
              patient={patient}
              hospitals={hospitals}
              primaryRoute={activeHospitalRoute}
              secondaryRoute={ambulanceToPatient}
              legToPatient={legToPatient}
              legToHospital={legToHospital}
              animationKey={animationKey}
              clickMode={clickMode}
              onMapClick={handleMapClick}
              onMarkerDrag={handleMarkerDrag}
              recommendedHospitalId={recommendedId}
              onMapBoundsChange={handleMapBoundsChange}
              discovering={discovering}
              onPhaseChange={setAnimPhase}
            />
          </div>

          {/* Animation status banner */}
          <div className={`flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-medium transition-all duration-300 ${phaseInfo[animPhase].color}`}>
            {phaseInfo[animPhase].icon}
            <span>{phaseInfo[animPhase].text}</span>
          </div>

          <div className="rounded-2xl border border-sky-100 bg-white p-4 shadow-sm">
            <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-sky-800">
              <Info size={16} /> Route Summary
            </h2>
            {routeStatus === null && !loading ? (
              <p className="mt-2 text-sm text-gray-500">
                Set the ambulance and patient locations, then click{" "}
                <b>Find Route</b> to dispatch the ambulance to the patient and
                then to the nearest hospital.
              </p>
            ) : (
              <dl className="mt-3 grid grid-cols-2 gap-3">
                <div className="rounded-lg bg-sky-50/50 p-2.5">
                  <dt className="flex items-center gap-1 text-[11px] font-medium uppercase tracking-wide text-gray-500">
                    <Truck size={11} /> From
                  </dt>
                  <dd className="mt-1 truncate text-sm font-medium text-gray-800" title={summaryRoute ? summaryRoute.source : ambulanceLabel || "Ambulance"}>
                    {summaryRoute ? summaryRoute.source : ambulanceLabel || "Ambulance"}
                  </dd>
                </div>
                <div className="rounded-lg bg-red-50/50 p-2.5">
                  <dt className="flex items-center gap-1 text-[11px] font-medium uppercase tracking-wide text-gray-500">
                    <HeartPulse size={11} /> To
                  </dt>
                  <dd className="mt-1 truncate text-sm font-medium text-gray-800" title={summaryRoute ? summaryRoute.destination : patientLabel || "Patient"}>
                    {summaryRoute ? summaryRoute.destination : patientLabel || "Patient"}
                  </dd>
                </div>
                <div className="rounded-lg bg-gray-50 p-2.5">
                  <dt className="text-[11px] font-medium uppercase tracking-wide text-gray-500">Distance</dt>
                  <dd className="mt-0.5 text-lg font-bold text-sky-700">
                    {summaryDistance != null ? `${(summaryDistance / 1000).toFixed(2)} km` : "—"}
                  </dd>
                </div>
                <div className="rounded-lg bg-gray-50 p-2.5">
                  <dt className="text-[11px] font-medium uppercase tracking-wide text-gray-500">Est. travel time</dt>
                  <dd className="mt-0.5 text-lg font-bold text-sky-700">
                    {summaryDuration != null
                      ? `${Math.round(summaryDuration / 60)} min`
                      : "—"}
                  </dd>
                </div>
              </dl>
            )}
            {statusMessage && routeStatus !== "success" && !loading && (
              <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
                {statusMessage}
              </p>
            )}
          </div>
        </div>

        {/* Side panel column */}
        <aside className="flex flex-col gap-3">
          <ActionButtons
            onFindRoute={handleFindRoute}
            onFindNearestHospital={handleFindNearestHospital}
            onReset={handleReset}
            onSampleData={handleSampleData}
            disabled={loading}
            canFindRoute={!!ambulance && !!patient}
          />
          <LocationPanel
            ambulance={ambulance}
            patient={patient}
            clickMode={clickMode}
            onSetClickMode={setClickMode}
            onSetAmbulance={handleSetAmbulance}
            onSetPatient={handleSetPatient}
          />
          <DashboardPanel
            ambulanceLabel={ambulanceLabel || (ambulance ? "Ambulance" : "")}
            patientLabel={patientLabel || (patient ? "Patient" : "")}
            recommendedHospital={summaryHospitalName}
            distanceMeters={summaryDistance}
            durationSeconds={summaryDuration}
            hospitalsEvaluated={hospitalRoutes.filter((r) => r.status === "success").length}
            algorithm={ALGORITHM_LABEL}
            routeStatus={routeStatus}
            statusMessage={statusMessage}
            isLoading={loading}
          />
          <HospitalList
            routes={hospitalRoutes}
            recommendedId={recommendedId}
            onSelect={handleSelectHospital}
            selectedId={selectedHospitalId}
          />
          <HospitalPanel
            hospitals={hospitals}
            onAdd={handleAddHospital}
            onRemove={handleRemoveHospital}
            onDiscover={handleDiscoverHospitals}
            discovering={discovering}
            discoveryError={discoveryError}
          />
          <AlgorithmPanel />
        </aside>
      </main>

      <footer className="border-t border-sky-200 bg-white py-3 text-center text-[11px] text-gray-500">
        Map data &copy; OpenStreetMap contributors · Routing by OSRM · Geocoding by Nominatim · Educational prototype only.
      </footer>
    </div>
  );
}
