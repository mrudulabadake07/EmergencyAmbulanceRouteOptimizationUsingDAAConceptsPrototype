import { useState } from "react";
import { Search, MapPin, Navigation, HeartPulse, Sparkles, RotateCcw, Truck } from "lucide-react";
import type { LatLng } from "@/lib/types";
import { geocodeAddress } from "@/lib/geocode";

interface LocationPanelProps {
  ambulance: LatLng | null;
  patient: LatLng | null;
  clickMode: "ambulance" | "patient" | null;
  onSetClickMode: (mode: "ambulance" | "patient" | null) => void;
  onSetAmbulance: (point: LatLng, label?: string) => void;
  onSetPatient: (point: LatLng, label?: string) => void;
}

function coordsText(point: LatLng | null): string {
  if (!point) return "";
  return `${point.lat.toFixed(5)}, ${point.lng.toFixed(5)}`;
}

export default function LocationPanel({
  ambulance,
  patient,
  clickMode,
  onSetClickMode,
  onSetAmbulance,
  onSetPatient,
}: LocationPanelProps) {
  const [ambQuery, setAmbQuery] = useState("");
  const [patQuery, setPatQuery] = useState("");
  const [ambSearching, setAmbSearching] = useState(false);
  const [patSearching, setPatSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function searchAmbulance() {
    if (!ambQuery.trim()) return;
    setAmbSearching(true);
    setError(null);
    const result = await geocodeAddress(ambQuery.trim());
    setAmbSearching(false);
    if (!result) {
      setError(`Could not find "${ambQuery}". Try a more specific address.`);
      return;
    }
    onSetAmbulance({ lat: result.lat, lng: result.lng }, result.displayName);
  }

  async function searchPatient() {
    if (!patQuery.trim()) return;
    setPatSearching(true);
    setError(null);
    const result = await geocodeAddress(patQuery.trim());
    setPatSearching(false);
    if (!result) {
      setError(`Could not find "${patQuery}". Try a more specific address.`);
      return;
    }
    onSetPatient({ lat: result.lat, lng: result.lng }, result.displayName);
  }

  const activeBtn = (mode: "ambulance" | "patient") =>
    clickMode === mode
      ? "bg-sky-600 text-white"
      : "bg-sky-50 text-sky-700 hover:bg-sky-100";

  return (
    <section className="rounded-xl border border-sky-100 bg-white p-4 shadow-sm">
      <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-sky-800">
        <Navigation size={16} /> Locations
      </h2>

      {/* Ambulance */}
      <div className="mt-3">
        <div className="flex items-center justify-between">
          <label className="flex items-center gap-1.5 text-xs font-medium text-gray-700">
            <Truck size={14} className="text-sky-700" /> Ambulance start
          </label>
          <button
            type="button"
            onClick={() =>
              onSetClickMode(clickMode === "ambulance" ? null : "ambulance")
            }
            className={`rounded-md px-2 py-1 text-xs font-medium transition ${activeBtn("ambulance")}`}
          >
            <MapPin size={12} className="mr-1 inline" />
            Pick on map
          </button>
        </div>
        <div className="mt-1 flex gap-2">
          <input
            type="text"
            value={ambQuery}
            onChange={(e) => setAmbQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && searchAmbulance()}
            placeholder="Search an address or place"
            className="min-w-0 flex-1 rounded-md border border-gray-300 px-2.5 py-1.5 text-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
          />
          <button
            type="button"
            onClick={searchAmbulance}
            disabled={ambSearching}
            className="flex items-center gap-1 rounded-md bg-sky-600 px-2.5 py-1.5 text-sm font-medium text-white hover:bg-sky-700 disabled:opacity-50"
          >
            <Search size={14} /> {ambSearching ? "..." : "Find"}
          </button>
        </div>
        <p className="mt-1 truncate text-xs text-gray-500">
          {ambulance ? coordsText(ambulance) : "Not set"}
        </p>
      </div>

      {/* Patient */}
      <div className="mt-4">
        <div className="flex items-center justify-between">
          <label className="flex items-center gap-1.5 text-xs font-medium text-gray-700">
            <HeartPulse size={14} className="text-red-600" /> Patient location
          </label>
          <button
            type="button"
            onClick={() =>
              onSetClickMode(clickMode === "patient" ? null : "patient")
            }
            className={`rounded-md px-2 py-1 text-xs font-medium transition ${activeBtn("patient")}`}
          >
            <MapPin size={12} className="mr-1 inline" />
            Pick on map
          </button>
        </div>
        <div className="mt-1 flex gap-2">
          <input
            type="text"
            value={patQuery}
            onChange={(e) => setPatQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && searchPatient()}
            placeholder="Search an address or place"
            className="min-w-0 flex-1 rounded-md border border-gray-300 px-2.5 py-1.5 text-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
          />
          <button
            type="button"
            onClick={searchPatient}
            disabled={patSearching}
            className="flex items-center gap-1 rounded-md bg-red-600 px-2.5 py-1.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
          >
            <Search size={14} /> {patSearching ? "..." : "Find"}
          </button>
        </div>
        <p className="mt-1 truncate text-xs text-gray-500">
          {patient ? coordsText(patient) : "Not set"}
        </p>
      </div>

      {error && (
        <p className="mt-3 rounded-md bg-amber-50 px-2.5 py-1.5 text-xs text-amber-800">
          {error}
        </p>
      )}

      <div className="mt-3 flex items-center gap-1.5 text-[11px] text-gray-400">
        <Sparkles size={12} /> Tip: search by street, area, city — e.g. "MG Road, Bengaluru".
      </div>
    </section>
  );
}

export function ActionButtons({
  onFindRoute,
  onFindNearestHospital,
  onReset,
  onSampleData,
  disabled,
  canFindRoute,
}: {
  onFindRoute: () => void;
  onFindNearestHospital: () => void;
  onReset: () => void;
  onSampleData: () => void;
  disabled?: boolean;
  canFindRoute?: boolean;
}) {
  return (
    <div className="grid grid-cols-2 gap-2">
      <button
        type="button"
        onClick={onFindRoute}
        disabled={disabled}
        className="col-span-2 flex items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-sky-600 to-sky-700 px-3 py-3 text-sm font-bold text-white shadow-md transition-all hover:shadow-lg hover:from-sky-700 hover:to-sky-800 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <Navigation size={16} /> Find Route
      </button>
      <button
        type="button"
        onClick={onFindNearestHospital}
        disabled={disabled}
        className="flex items-center justify-center gap-1.5 rounded-xl bg-teal-600 px-3 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <HeartPulse size={15} /> Compare Hospitals
      </button>
      <button
        type="button"
        onClick={onSampleData}
        className="flex items-center justify-center gap-1.5 rounded-xl bg-amber-500 px-3 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-amber-600"
      >
        <Sparkles size={15} /> Sample Data
      </button>
      <button
        type="button"
        onClick={onReset}
        className="col-span-2 flex items-center justify-center gap-1.5 rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
      >
        <RotateCcw size={14} /> Reset Everything
      </button>
    </div>
  );
}
