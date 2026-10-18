import { Clock, Gauge, Building2, Activity, Stethoscope, AlertTriangle } from "lucide-react";
import type { HospitalRoute, RouteStatus } from "@/lib/types";
import { formatDistance, formatDuration } from "@/lib/osrm";

interface DashboardPanelProps {
  ambulanceLabel: string;
  patientLabel: string;
  recommendedHospital: string | null;
  distanceMeters: number | null;
  durationSeconds: number | null;
  hospitalsEvaluated: number;
  algorithm: string;
  routeStatus: RouteStatus | null;
  statusMessage?: string | null;
  isLoading: boolean;
}

function Stat({
  icon,
  label,
  value,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  accent: string;
}) {
  return (
    <div className="rounded-lg border border-gray-100 bg-gray-50 p-2.5">
      <div className={`flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide ${accent}`}>
        {icon} {label}
      </div>
      <div className="mt-0.5 text-sm font-semibold text-gray-800">{value}</div>
    </div>
  );
}

const STATUS_STYLES: Record<string, string> = {
  success: "bg-emerald-50 text-emerald-700 border-emerald-200",
  unavailable: "bg-amber-50 text-amber-800 border-amber-200",
  "no-route": "bg-amber-50 text-amber-800 border-amber-200",
  error: "bg-red-50 text-red-700 border-red-200",
};

export default function DashboardPanel({
  ambulanceLabel,
  patientLabel,
  recommendedHospital,
  distanceMeters,
  durationSeconds,
  hospitalsEvaluated,
  algorithm,
  routeStatus,
  statusMessage,
  isLoading,
}: DashboardPanelProps) {
  const statusText = isLoading
    ? "Calculating..."
    : routeStatus === "success"
      ? "Route ready"
      : routeStatus
        ? routeStatus === "no-route"
          ? "No road route"
          : "Route unavailable"
        : "No route requested";

  const statusClass = isLoading
    ? "bg-sky-50 text-sky-700 border-sky-200"
    : routeStatus
      ? STATUS_STYLES[routeStatus]
      : "bg-gray-50 text-gray-600 border-gray-200";

  return (
    <section className="rounded-xl border border-sky-100 bg-white p-4 shadow-sm">
      <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-sky-800">
        <Activity size={16} /> Emergency Dashboard
      </h2>

      <div className="mt-3 grid grid-cols-1 gap-2">
        <Stat
          icon={<Stethoscope size={12} />}
          label="Ambulance"
          value={ambulanceLabel || "Not set"}
          accent="text-sky-700"
        />
        <Stat
          icon={<Stethoscope size={12} />}
          label="Patient"
          value={patientLabel || "Not set"}
          accent="text-red-600"
        />
        <Stat
          icon={<Building2 size={12} />}
          label="Recommended Hospital"
          value={recommendedHospital || "—"}
          accent="text-teal-700"
        />
        <div className="grid grid-cols-2 gap-2">
          <Stat
            icon={<Gauge size={12} />}
            label="Distance"
            value={distanceMeters != null ? formatDistance(distanceMeters) : "—"}
            accent="text-sky-700"
          />
          <Stat
            icon={<Clock size={12} />}
            label="Est. Travel Time"
            value={durationSeconds != null ? formatDuration(durationSeconds) : "—"}
            accent="text-sky-700"
          />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Stat
            icon={<Building2 size={12} />}
            label="Hospitals Evaluated"
            value={String(hospitalsEvaluated)}
            accent="text-teal-700"
          />
          <Stat
            icon={<Activity size={12} />}
            label="Algorithm"
            value={algorithm}
            accent="text-sky-700"
          />
        </div>
      </div>

      <div className={`mt-3 rounded-md border px-3 py-2 text-xs font-medium ${statusClass}`}>
        Route status: {statusText}
      </div>

      {statusMessage && routeStatus !== "success" && !isLoading && (
        <div className="mt-2 flex items-start gap-1.5 rounded-md bg-amber-50 px-2.5 py-1.5 text-xs text-amber-800">
          <AlertTriangle size={14} className="mt-0.5 shrink-0" />
          <span>{statusMessage}</span>
        </div>
      )}
    </section>
  );
}

interface HospitalListProps {
  routes: HospitalRoute[];
  recommendedId: string | null;
  onSelect: (hospitalId: string) => void;
  selectedId: string | null;
}

export function HospitalList({
  routes,
  recommendedId,
  onSelect,
  selectedId,
}: HospitalListProps) {
  const sorted = [...routes].sort(
    (a, b) =>
      (a.durationSeconds || Infinity) - (b.durationSeconds || Infinity),
  );

  return (
    <section className="rounded-xl border border-sky-100 bg-white p-4 shadow-sm">
      <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-sky-800">
        <Building2 size={16} /> Alternative Hospitals
      </h2>
      <p className="mt-1 text-xs text-gray-500">
        Sorted by estimated travel time (greedy best-first selection).
      </p>

      {sorted.length === 0 ? (
        <p className="mt-3 text-xs text-gray-400">
          No hospital routes yet. Click <span className="font-semibold">Find Nearest Hospital</span>.
        </p>
      ) : (
        <ul className="mt-3 space-y-2">
          {sorted.map((r) => {
            const isRecommended = r.hospital.id === recommendedId;
            const isSelected = r.hospital.id === selectedId;
            const ok = r.status === "success";
            return (
              <li key={r.hospital.id}>
                <button
                  type="button"
                  onClick={() => onSelect(r.hospital.id)}
                  className={`w-full rounded-lg border p-2.5 text-left transition ${
                    isRecommended
                      ? "border-amber-300 bg-amber-50"
                      : isSelected
                        ? "border-sky-300 bg-sky-50"
                        : "border-gray-200 bg-white hover:border-sky-200 hover:bg-sky-50/50"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-semibold text-gray-800">
                      {r.hospital.name}
                    </span>
                    {isRecommended && (
                      <span className="shrink-0 rounded-full bg-amber-500 px-2 py-0.5 text-[10px] font-bold uppercase text-white">
                        Best
                      </span>
                    )}
                  </div>
                  <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-gray-600">
                    {ok ? (
                      <>
                        <span className="flex items-center gap-1">
                          <Clock size={11} /> {formatDuration(r.durationSeconds)}
                        </span>
                        <span className="flex items-center gap-1">
                          <Gauge size={11} /> {formatDistance(r.distanceMeters)}
                        </span>
                      </>
                    ) : (
                      <span className="text-amber-700">
                        Route unavailable{r.message ? `: ${r.message}` : ""}
                      </span>
                    )}
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
