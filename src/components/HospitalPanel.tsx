import { useState } from "react";
import { Building2, Plus, Search, X } from "lucide-react";
import type { Hospital } from "@/lib/types";

interface HospitalPanelProps {
  hospitals: Hospital[];
  onAdd: (h: Hospital) => void;
  onRemove: (id: string) => void;
  onDiscover: (center: { lat: number; lng: number }) => Promise<void>;
  discovering: boolean;
  discoveryError: string | null;
}

export default function HospitalPanel({
  hospitals,
  onAdd,
  onRemove,
  onDiscover,
  discovering,
  discoveryError,
}: HospitalPanelProps) {
  const [name, setName] = useState("");
  const [lat, setLat] = useState("");
  const [lng, setLng] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    const latN = parseFloat(lat);
    const lngN = parseFloat(lng);
    if (!name.trim()) {
      setFormError("Enter a hospital name.");
      return;
    }
    if (Number.isNaN(latN) || Number.isNaN(lngN) || latN < -90 || latN > 90 || lngN < -180 || lngN > 180) {
      setFormError("Enter valid coordinates (lat between -90 and 90, lng between -180 and 180).");
      return;
    }
    onAdd({
      id: `manual-${Date.now()}`,
      name: name.trim(),
      lat: latN,
      lng: lngN,
      manual: true,
    });
    setName("");
    setLat("");
    setLng("");
  }

  return (
    <section className="rounded-xl border border-sky-100 bg-white p-4 shadow-sm">
      <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-sky-800">
        <Building2 size={16} /> Hospitals
      </h2>

      {/* Auto-discover */}
      <button
        type="button"
        onClick={() => onDiscover(hospitals[0] ?? { lat: 12.9716, lng: 77.5946 })}
        disabled={discovering}
        className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-md bg-teal-50 px-3 py-2 text-xs font-semibold text-teal-700 transition hover:bg-teal-100 disabled:opacity-50"
      >
        <Search size={13} /> {discovering ? "Searching OpenStreetMap..." : "Auto-discover nearby (OpenStreetMap)"}
      </button>
      {discoveryError && (
        <p className="mt-1.5 rounded bg-amber-50 px-2 py-1 text-[11px] text-amber-800">
          {discoveryError}
        </p>
      )}

      {/* Manual entry */}
      <form onSubmit={handleAdd} className="mt-3 space-y-2">
        <p className="text-xs font-medium text-gray-600">Add a hospital manually</p>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Hospital name"
          className="w-full rounded-md border border-gray-300 px-2.5 py-1.5 text-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
        />
        <div className="grid grid-cols-2 gap-2">
          <input
            type="text"
            value={lat}
            onChange={(e) => setLat(e.target.value)}
            placeholder="Latitude"
            className="rounded-md border border-gray-300 px-2.5 py-1.5 text-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
          />
          <input
            type="text"
            value={lng}
            onChange={(e) => setLng(e.target.value)}
            placeholder="Longitude"
            className="rounded-md border border-gray-300 px-2.5 py-1.5 text-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
          />
        </div>
        {formError && <p className="text-[11px] text-red-600">{formError}</p>}
        <button
          type="submit"
          className="flex w-full items-center justify-center gap-1.5 rounded-md bg-sky-600 px-3 py-2 text-xs font-semibold text-white hover:bg-sky-700"
        >
          <Plus size={13} /> Add Hospital
        </button>
      </form>

      {/* List */}
      <div className="mt-3">
        <p className="text-xs font-medium text-gray-600">
          {hospitals.length} hospital{hospitals.length === 1 ? "" : "s"} on map
        </p>
        <ul className="mt-1.5 max-h-40 space-y-1 overflow-y-auto pr-1">
          {hospitals.map((h) => (
            <li
              key={h.id}
              className="flex items-center justify-between gap-2 rounded-md bg-gray-50 px-2 py-1.5 text-xs"
            >
              <span className="truncate text-gray-700">
                {h.name}
                {h.manual && (
                  <span className="ml-1 rounded bg-sky-100 px-1 text-[10px] text-sky-700">manual</span>
                )}
              </span>
              <button
                type="button"
                onClick={() => onRemove(h.id)}
                className="shrink-0 text-gray-400 hover:text-red-600"
                aria-label={`Remove ${h.name}`}
              >
                <X size={13} />
              </button>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
