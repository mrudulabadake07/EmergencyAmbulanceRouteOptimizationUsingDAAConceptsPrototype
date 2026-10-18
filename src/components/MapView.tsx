import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Crosshair, Maximize2, Layers } from "lucide-react";
import { createRoot } from "react-dom/client";
import type { Hospital, LatLng, RouteSegment } from "@/lib/types";

export interface MapBounds {
  south: number;
  west: number;
  north: number;
  east: number;
}

export type AnimationPhase = "idle" | "to-patient" | "pickup" | "to-hospital" | "arrived";

interface MapViewProps {
  ambulance: LatLng | null;
  patient: LatLng | null;
  hospitals: Hospital[];
  primaryRoute: RouteSegment[] | null;
  secondaryRoute?: RouteSegment[] | null;
  legToPatient?: RouteSegment[] | null;
  legToHospital?: RouteSegment[] | null;
  animationKey?: number;
  clickMode: "ambulance" | "patient" | null;
  onMapClick: (point: LatLng) => void;
  onMarkerDrag?: (which: "ambulance" | "patient", point: LatLng) => void;
  recommendedHospitalId?: string | null;
  onMapBoundsChange?: (bounds: MapBounds) => void;
  discovering?: boolean;
  onPhaseChange?: (phase: AnimationPhase) => void;
}

const COLORS = {
  primaryRoute: "#0369a1",
  secondaryRoute: "#dc2626",
  animationToPatient: "#dc2626",
  animationToHospital: "#0369a1",
};

function emojiIcon(emoji: string, size = 30, badge?: string, pulse = false) {
  const badgeHtml = badge
    ? `<span style="position:absolute;top:-6px;right:-6px;background:#f59e0b;color:#fff;border-radius:9999px;font-size:10px;font-weight:700;width:16px;height:16px;display:flex;align-items:center;justify-content:center;border:1.5px solid #fff;">${badge}</span>`
    : "";
  const pulseHtml = pulse
    ? `<span style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:${size}px;height:${size}px;border-radius:9999px;background:rgba(220,38,38,0.3);animation:pulse-ring 1.5s ease-out infinite;"></span>`
    : "";
  return L.divIcon({
    className: "",
    html: `
      <div style="position:relative;font-size:${size}px;line-height:1;filter:drop-shadow(0 2px 3px rgba(0,0,0,0.4));">
        ${pulseHtml}
        <span style="position:relative;z-index:1;">${emoji}</span>
        ${badgeHtml}
      </div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

const ambulanceIcon = emojiIcon("🚑", 32);
const ambulanceDragIcon = emojiIcon("🚑", 36);
const patientIcon = emojiIcon("🤕", 30, undefined, true);
const patientDragIcon = emojiIcon("🤕", 34, undefined, true);
const hospitalIcon = emojiIcon("🏥", 28);
const recommendedIcon = emojiIcon("🏥", 32, "★");
const movingAmbulanceIcon = emojiIcon("🚑", 38);

// Map control button rendered as HTML overlay
function MapControlButton({
  icon,
  label,
  onClick,
  active,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  active?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      title={label}
      className={`flex items-center justify-center rounded-lg shadow-md transition-all duration-200 ${
        active
          ? "bg-sky-600 text-white"
          : "bg-white text-gray-700 hover:bg-sky-50 hover:text-sky-700"
      }`}
      style={{ width: 36, height: 36 }}
    >
      {icon}
    </button>
  );
}

export default function MapView({
  ambulance,
  patient,
  hospitals,
  primaryRoute,
  secondaryRoute,
  legToPatient,
  legToHospital,
  animationKey = 0,
  clickMode,
  onMapClick,
  onMarkerDrag,
  recommendedHospitalId,
  onMapBoundsChange,
  discovering = false,
  onPhaseChange,
}: MapViewProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerRef = useRef<L.LayerGroup | null>(null);
  const movingLayerRef = useRef<L.LayerGroup | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const markersRef = useRef<{ ambulance?: L.Marker; patient?: L.Marker }>({});
  const clickHandlerRef = useRef(onMapClick);
  const dragHandlerRef = useRef(onMarkerDrag);
  const boundsHandlerRef = useRef(onMapBoundsChange);
  const phaseHandlerRef = useRef(onPhaseChange);
  const legToPatientRef = useRef(legToPatient);
  const legToHospitalRef = useRef(legToHospital);
  const fitBoundsRef = useRef<(() => void)>(() => {});

  useEffect(() => {
    clickHandlerRef.current = onMapClick;
  }, [onMapClick]);
  useEffect(() => {
    dragHandlerRef.current = onMarkerDrag;
  }, [onMarkerDrag]);
  useEffect(() => {
    boundsHandlerRef.current = onMapBoundsChange;
  }, [onMapBoundsChange]);
  useEffect(() => {
    phaseHandlerRef.current = onPhaseChange;
  }, [onPhaseChange]);
  useEffect(() => {
    legToPatientRef.current = legToPatient;
  }, [legToPatient]);
  useEffect(() => {
    legToHospitalRef.current = legToHospital;
  }, [legToHospital]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = L.map(containerRef.current, {
      center: [12.9716, 77.5946],
      zoom: 13,
      zoomControl: false,
    });
    L.control.zoom({ position: "topright" }).addTo(map);
    const tiles = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "&copy; OpenStreetMap contributors",
      maxZoom: 19,
    }).addTo(map);
    const layer = L.layerGroup().addTo(map);
    const movingLayer = L.layerGroup().addTo(map);
    map.on("click", (e: L.LeafletMouseEvent) => {
      clickHandlerRef.current({ lat: e.latlng.lat, lng: e.latlng.lng });
    });

    const reportBounds = () => {
      const b = map.getBounds();
      boundsHandlerRef.current?.({
        south: b.getSouth(),
        west: b.getWest(),
        north: b.getNorth(),
        east: b.getEast(),
      });
    };
    map.on("moveend", reportBounds);
    reportBounds();

    fitBoundsRef.current = () => {
      const allBounds: L.LatLngExpression[] = [];
      if (ambulance) allBounds.push([ambulance.lat, ambulance.lng]);
      if (patient) allBounds.push([patient.lat, patient.lng]);
      hospitals.forEach((h) => allBounds.push([h.lat, h.lng]));
      if (allBounds.length > 1) {
        map.fitBounds(L.latLngBounds(allBounds), { padding: [60, 60] });
      } else if (allBounds.length === 1) {
        map.setView(allBounds[0], 14);
      }
    };

    mapRef.current = map;
    layerRef.current = layer;
    movingLayerRef.current = movingLayer;
    tileLayerRef.current = tiles;

    setTimeout(() => map.invalidateSize(), 100);
    return () => {
      map.remove();
      mapRef.current = null;
      layerRef.current = null;
      movingLayerRef.current = null;
      tileLayerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Inject pulse keyframes once
  useEffect(() => {
    const styleId = "mapview-pulse-keyframes";
    if (document.getElementById(styleId)) return;
    const style = document.createElement("style");
    style.id = styleId;
    style.textContent = `
      @keyframes pulse-ring {
        0% { transform: translate(-50%,-50%) scale(0.8); opacity: 0.6; }
        100% { transform: translate(-50%,-50%) scale(2.2); opacity: 0; }
      }
    `;
    document.head.appendChild(style);
  }, []);

  // Static markers + route lines.
  useEffect(() => {
    const layer = layerRef.current;
    const map = mapRef.current;
    if (!layer || !map) return;
    layer.clearLayers();
    markersRef.current = {};

    const bounds: L.LatLngExpression[] = [];

    if (ambulance) {
      const m = L.marker([ambulance.lat, ambulance.lng], {
        icon: ambulanceIcon,
        draggable: true,
        autoPan: true,
      })
        .bindPopup("🚑 Ambulance start — drag to reposition")
        .on("dragend", (e: L.LeafletEvent) => {
          const ll = (e.target as L.Marker).getLatLng();
          dragHandlerRef.current?.("ambulance", { lat: ll.lat, lng: ll.lng });
        })
        .on("drag", () => {
          if ((m as L.Marker).isPopupOpen()) (m as L.Marker).closePopup();
        })
        .addTo(layer);
      markersRef.current.ambulance = m;
      bounds.push([ambulance.lat, ambulance.lng]);
    }
    if (patient) {
      const m = L.marker([patient.lat, patient.lng], {
        icon: patientIcon,
        draggable: true,
        autoPan: true,
      })
        .bindPopup("🤕 Patient location — drag to reposition")
        .on("dragend", (e: L.LeafletEvent) => {
          const ll = (e.target as L.Marker).getLatLng();
          dragHandlerRef.current?.("patient", { lat: ll.lat, lng: ll.lng });
        })
        .on("drag", () => {
          if ((m as L.Marker).isPopupOpen()) (m as L.Marker).closePopup();
        })
        .addTo(layer);
      markersRef.current.patient = m;
      bounds.push([patient.lat, patient.lng]);
    }

    // Only fit bounds when markers/routes change substantially — not on every
    // hospital discovery update. We fit when there are few items (initial setup)
    // but skip re-fitting once the user has started interacting.
    const shouldFit =
      bounds.length > 0 &&
      (!primaryRoute || !secondaryRoute); // don't auto-fit once routes are drawn
    if (shouldFit) {
      if (bounds.length > 1) {
        map.fitBounds(L.latLngBounds(bounds), {
          padding: [60, 60],
          maxZoom: 15,
          animate: true,
        });
      } else if (bounds.length === 1) {
        map.setView(bounds[0], 14, { animate: true });
      }
    }

    // Route lines
    if (secondaryRoute && secondaryRoute.length > 1) {
      L.polyline(secondaryRoute.map((p) => [p.lat, p.lng]), {
        color: COLORS.secondaryRoute,
        weight: 4,
        opacity: 0.7,
        dashArray: "10 8",
      }).addTo(layer);
    }
    if (primaryRoute && primaryRoute.length > 1) {
      L.polyline(primaryRoute.map((p) => [p.lat, p.lng]), {
        color: COLORS.primaryRoute,
        weight: 5,
        opacity: 0.85,
      }).addTo(layer);
    }

    // Hospital markers — use a separate sub-layer so they don't affect fitBounds
    for (const h of hospitals) {
      const isRecommended = h.id === recommendedHospitalId;
      L.marker([h.lat, h.lng], {
        icon: isRecommended ? recommendedIcon : hospitalIcon,
        zIndexOffset: isRecommended ? 500 : 0,
      })
        .bindPopup(
          `🏥 <b>${h.name}</b>${h.address ? `<br/>${h.address}` : ""}${
            isRecommended ? "<br/><i>Recommended (nearest)</i>" : ""
          }`,
        )
        .addTo(layer);
    }
  }, [ambulance, patient, hospitals, primaryRoute, secondaryRoute, recommendedHospitalId]);

  // Two-phase ambulance animation
  useEffect(() => {
    const movingLayer = movingLayerRef.current;
    const map = mapRef.current;
    if (!movingLayer || !map) return;
    movingLayer.clearLayers();

    if (animationKey === 0) {
      phaseHandlerRef.current?.("idle");
      return;
    }

    const phase1 = legToPatientRef.current && legToPatientRef.current.length >= 2 ? legToPatientRef.current : null;
    const phase2 = legToHospitalRef.current && legToHospitalRef.current.length >= 2 ? legToHospitalRef.current : null;
    if (!phase1 && !phase2) return;

    const startPt = (phase1 ?? phase2)![0];
    const marker = L.marker([startPt.lat, startPt.lng], {
      icon: movingAmbulanceIcon,
      zIndexOffset: 1000,
    })
      .bindPopup("🚑 Ambulance departing for patient")
      .addTo(movingLayer);
    marker.openPopup();
    phaseHandlerRef.current?.("to-patient");

    // Animated route line that grows with the ambulance
    const routeLine = L.polyline([], {
      color: COLORS.animationToPatient,
      weight: 4,
      opacity: 0.8,
    }).addTo(movingLayer);

    let rafId = 0;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    let cancelled = false;

    const animateAlong = (
      leg: RouteSegment[],
      durationMs: number,
      routeColor: string,
      onDone: () => void,
    ) => {
      routeLine.setStyle({ color: routeColor });
      const segs = leg.length - 1;
      let startTs: number | null = null;
      const step = (ts: number) => {
        if (cancelled) return;
        if (startTs === null) startTs = ts;
        const progress = Math.min((ts - startTs) / durationMs, 1);
        const segFloat = progress * segs;
        const segIdx = Math.min(Math.floor(segFloat), segs - 1);
        const segT = segFloat - segIdx;
        const a = leg[segIdx];
        const b = leg[segIdx + 1];
        const lat = a.lat + (b.lat - a.lat) * segT;
        const lng = a.lng + (b.lng - a.lng) * segT;
        marker.setLatLng([lat, lng]);

        // Update the growing route line
        const pointsSoFar: L.LatLngExpression[] = [];
        for (let i = 0; i <= segIdx; i++) {
          pointsSoFar.push([leg[i].lat, leg[i].lng]);
        }
        pointsSoFar.push([lat, lng]);
        routeLine.setLatLngs(pointsSoFar);

        if (progress < 1) {
          rafId = requestAnimationFrame(step);
        } else {
          marker.setLatLng([leg[leg.length - 1].lat, leg[leg.length - 1].lng]);
          routeLine.setLatLngs(leg.map((p) => [p.lat, p.lng]));
          onDone();
        }
      };
      rafId = requestAnimationFrame(step);
    };

    const durOf = (leg: RouteSegment[]) =>
      Math.min(8000, Math.max(2500, (leg.length - 1) * 200));

    if (phase1) {
      animateAlong(phase1, durOf(phase1), COLORS.animationToPatient, () => {
        if (cancelled) return;
        marker.setPopupContent("🚑 Ambulance has reached the patient — picking up patient...");
        marker.openPopup();
        phaseHandlerRef.current?.("pickup");

        if (!phase2) {
          marker.setPopupContent("🚑 Ambulance has reached the patient");
          marker.openPopup();
          phaseHandlerRef.current?.("arrived");
          return;
        }

        timeoutId = setTimeout(() => {
          if (cancelled) return;
          timeoutId = null;
          marker.setPopupContent("🚑 Patient picked up — heading to the nearest hospital");
          marker.openPopup();
          phaseHandlerRef.current?.("to-hospital");
          animateAlong(phase2, durOf(phase2), COLORS.animationToHospital, () => {
            if (cancelled) return;
            marker.setPopupContent("🚑 Ambulance has arrived at the hospital with the patient");
            marker.openPopup();
            phaseHandlerRef.current?.("arrived");
          });
        }, 2500);
      });
    } else if (phase2) {
      phaseHandlerRef.current?.("to-hospital");
      animateAlong(phase2, durOf(phase2), COLORS.animationToHospital, () => {
        if (cancelled) return;
        marker.setPopupContent("🚑 Ambulance has arrived at the hospital with the patient");
        marker.openPopup();
        phaseHandlerRef.current?.("arrived");
      });
    }

    return () => {
      cancelled = true;
      cancelAnimationFrame(rafId);
      if (timeoutId) clearTimeout(timeoutId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [animationKey]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    el.style.cursor = clickMode ? "crosshair" : "";
  }, [clickMode]);

  // Control button handlers
  const handleFitBounds = () => fitBoundsRef.current();
  const handleToggleSatellite = () => {
    const map = mapRef.current;
    if (!map || !tileLayerRef.current) return;
    const currentUrl = (tileLayerRef.current as unknown as { _url: string })._url;
    map.removeLayer(tileLayerRef.current);
    if (currentUrl.includes("sat") || currentUrl.includes("ArcGIS")) {
      tileLayerRef.current = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "&copy; OpenStreetMap contributors",
        maxZoom: 19,
      }).addTo(map);
    } else {
      tileLayerRef.current = L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", {
        attribution: "&copy; Esri, Maxar, Earthstar Geographics",
        maxZoom: 19,
      }).addTo(map);
    }
  };

  // Render map controls via portal overlay
  const controlsContainerRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!controlsContainerRef.current) return;
    const root = createRoot(controlsContainerRef.current);
    root.render(
      <div className="flex flex-col gap-1.5">
        <MapControlButton
          icon={<Maximize2 size={16} />}
          label="Fit all markers"
          onClick={handleFitBounds}
        />
        <MapControlButton
          icon={<Layers size={16} />}
          label="Toggle satellite view"
          onClick={handleToggleSatellite}
        />
      </div>,
    );
    return () => root.unmount();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="relative h-full w-full">
      <div ref={containerRef} className="h-full w-full" />

      {/* Map control buttons (top-left) */}
      <div
        ref={controlsContainerRef}
        className="absolute left-3 top-3 z-[1000]"
      />

      {/* Discovering indicator */}
      {discovering && (
        <div className="pointer-events-none absolute bottom-3 left-1/2 z-[1000] -translate-x-1/2 rounded-full bg-white/95 px-4 py-1.5 text-xs font-medium text-sky-800 shadow-lg backdrop-blur-sm">
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-sky-300 border-t-sky-700" />
            Discovering hospitals on the map…
          </span>
        </div>
      )}

      {/* Hospital count badge */}
      {hospitals.length > 0 && (
        <div className="pointer-events-none absolute bottom-3 right-3 z-[1000] rounded-full bg-white/95 px-3 py-1 text-xs font-semibold text-gray-700 shadow-lg backdrop-blur-sm">
          🏥 {hospitals.length} facilit{hospitals.length === 1 ? "y" : "ies"} on map
        </div>
      )}

      {/* Click mode banner */}
      {clickMode && (
        <div className="pointer-events-none absolute left-1/2 top-3 z-[1000] -translate-x-1/2 animate-pulse rounded-full bg-sky-700 px-4 py-1.5 text-xs font-medium text-white shadow-lg">
          <Crosshair size={12} className="mr-1 inline" />
          Click the map to set the {clickMode === "ambulance" ? "ambulance" : "patient"} location
        </div>
      )}
    </div>
  );
}
