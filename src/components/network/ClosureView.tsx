import { useEffect, useRef, useState } from "react";
import maplibregl, { Map as MlMap } from "maplibre-gl";
import { AlertTriangle, ChevronRight, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  DIRECTION_NAME,
  closedDirs,
  closureBefore,
  closureScenario,
  type CapacityLevel,
  type Closed,
  type ClosureFile,
  type Dir,
  type DirectionRow,
  type St130Result,
} from "./closureModel";
import { DAY_TYPE_LABEL, dayLabel, fileForDay, incompleteStations, type ClosureDays } from "./closureDays";
import { LIMIT_RANGE, LIMIT_STEP, applySt130Limit, st130CurrentLimit, type LimitFile, type LimitedRow, type Surface } from "./closureLimit";

export const CLOSURE_BANNER = "Model, not measured: no real closure observed; detour split and st130 capacity are assumptions.";

/** OpenStreetMap raster tiles, desaturated so the routes stand out. */
const MAP_STYLE: maplibregl.StyleSpecification = {
  version: 8,
  sources: {
    osm: {
      type: "raster",
      tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
      tileSize: 256,
      maxzoom: 19,
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    },
  },
  layers: [{ id: "osm", type: "raster", source: "osm", paint: { "raster-saturation": -0.9, "raster-brightness-max": 0.85, "raster-contrast": -0.1 } }],
};

const MEASURED = "#22c55e";
const MODELLED = "#eab308";
const VT3_CLOSABLE = "#cbd5e1";
const VT3_HOVER = "#ffffff";

/** How full -> colour. */
function fullColor(pct: number): string {
  if (pct < 70) return "#22c55e";
  if (pct < 90) return "#eab308";
  if (pct <= 100) return "#f97316";
  return "#ef4444";
}

const hourLabel = (h: number) => `${String(h).padStart(2, "0")}–${String((h + 1) % 24).padStart(2, "0")}`;
const veh = (v: number) => Math.round(v).toLocaleString("en");
const signed = (v: number) => `${v >= 0 ? "+" : "−"}${veh(Math.abs(v))}`;

function km(a: [number, number], b: [number, number]): number {
  const r = Math.PI / 180;
  const dLat = (b[0] - a[0]) * r;
  const dLon = (b[1] - a[1]) * r;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a[0] * r) * Math.cos(b[0] * r) * Math.sin(dLon / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

/** The part of a polyline between two km marks (the cumulative distance scaled to the route's length). */
function section(poly: [number, number][], lengthKm: number, fromKm: number, toKm: number): [number, number][] {
  const cum = [0];
  for (let i = 1; i < poly.length; i++) cum.push(cum[i - 1] + km(poly[i - 1], poly[i]));
  const scale = lengthKm / (cum[cum.length - 1] || 1);
  return poly.filter((_, i) => cum[i] * scale >= fromKm && cum[i] * scale <= toKm);
}

const line = (poly: [number, number][], props: Record<string, unknown>): GeoJSON.Feature => ({
  type: "Feature",
  geometry: { type: "LineString", coordinates: poly.map(([lat, lon]) => [lon, lat]) },
  properties: props,
});

/** A measured (green) or modelled (amber) dot after a number; the full tag text and its source in the hover. */
function Dot({ measured, title }: { measured: boolean; title: string }) {
  return (
    <span
      title={`${measured ? "Measured" : "Modelled"}: ${title}`}
      className="ml-1 inline-block h-2 w-2 cursor-help rounded-full align-middle"
      style={{ backgroundColor: measured ? MEASURED : MODELLED }}
    />
  );
}

function FullBar({ pct, title }: { pct: number; title: string }) {
  return (
    <span className="inline-flex items-center gap-1.5" title={title}>
      <span className="relative inline-block h-1.5 w-20 overflow-hidden rounded bg-bg-base align-middle">
        <span className="absolute inset-y-0 left-0 rounded" style={{ width: `${Math.min(100, pct)}%`, backgroundColor: fullColor(pct) }} />
      </span>
      <span className="font-mono">{pct.toFixed(0)} %</span>
    </span>
  );
}

function Toggle<T extends string>({ options, value, onChange }: { options: { value: T; label: string; title?: string }[]; value: T | null; onChange: (v: T) => void }) {
  return (
    <div className="grid gap-0.5 rounded-md border border-border-subtle bg-bg-base p-0.5" style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}>
      {options.map((o) => (
        <button
          key={o.value}
          title={o.title}
          onClick={() => onChange(o.value)}
          className={cn("rounded px-1.5 py-0.5 text-[11px] font-medium", value === o.value ? "bg-accent text-white" : "text-text-secondary hover:text-text-primary")}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/* ---------- map ---------- */

interface MapProps {
  file: ClosureFile;
  /** % full per st130 direction (the normal traffic when nothing is closed). */
  pctFull: Record<Dir, number>;
  closed: Closed | null;
  onCloseVt3: () => void;
}

function ClosureMap({ file, pctFull, closed, onCloseVt3 }: MapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MlMap | null>(null);
  const [ready, setReady] = useState(false);
  const onCloseRef = useRef(onCloseVt3);
  onCloseRef.current = onCloseVt3;

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: MAP_STYLE,
      center: [23.95, 61.25],
      zoom: 9.5,
      attributionControl: {
        compact: false,
        customAttribution: [`Routes: ${file.attribution}, downloaded ${file.osm_downloaded_utc.slice(0, 10)}`, "Traffic data: Fintraffic / Digitraffic, CC BY 4.0"],
      },
    });
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
    map.addControl(new maplibregl.ScaleControl({ unit: "metric" }), "bottom-left");
    map.on("load", () => {
      map.addSource("routes", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
      const byKind = (kind: string): maplibregl.FilterSpecification => ["==", ["get", "kind"], kind];
      map.addLayer({ id: "western", type: "line", source: "routes", filter: byKind("western"), paint: { "line-color": "#9aa7bd", "line-width": 3, "line-opacity": 0.8, "line-offset": 2 } });
      map.addLayer({ id: "vt3-open", type: "line", source: "routes", filter: byKind("vt3_open"), paint: { "line-color": "#64748b", "line-width": 2.5, "line-opacity": 0.7, "line-offset": 2 } });
      map.addLayer({
        id: "vt3-closable",
        type: "line",
        source: "routes",
        filter: byKind("vt3_closable"),
        paint: { "line-color": VT3_CLOSABLE, "line-width": 5, "line-opacity": 0.9, "line-offset": 3 },
      });
      map.addLayer({
        id: "vt3-closed",
        type: "line",
        source: "routes",
        filter: byKind("vt3_closed"),
        paint: { "line-color": "#ef4444", "line-width": 4, "line-dasharray": [2, 1.5], "line-offset": 3 },
      });
      map.addLayer({ id: "st130", type: "line", source: "routes", filter: byKind("st130"), paint: { "line-color": ["get", "color"], "line-width": 5, "line-offset": 3.5 } });
      // vt3's closable section: pointer, highlight on hover, a click closes it (both directions)
      map.on("mouseenter", "vt3-closable", () => {
        map.getCanvas().style.cursor = "pointer";
        map.setPaintProperty("vt3-closable", "line-color", VT3_HOVER);
        map.setPaintProperty("vt3-closable", "line-width", 7);
      });
      map.on("mouseleave", "vt3-closable", () => {
        map.getCanvas().style.cursor = "";
        map.setPaintProperty("vt3-closable", "line-color", VT3_CLOSABLE);
        map.setPaintProperty("vt3-closable", "line-width", 5);
      });
      map.on("click", "vt3-closable", () => onCloseRef.current());
      for (const id of ["tms:440", "tms:433", "tms:402"]) {
        const s = file.stations[id];
        const el = document.createElement("div");
        el.className = "relative";
        const dot = document.createElement("div");
        dot.className = "h-3.5 w-3.5 rounded-full border-2 border-white shadow";
        dot.style.backgroundColor = s.road === "vt3" ? "#ef4444" : "#3b82f6";
        const tag = document.createElement("div");
        tag.className =
          "pointer-events-none absolute left-full top-1/2 ml-1.5 -translate-y-1/2 whitespace-nowrap rounded bg-bg-panel/95 px-1.5 py-0.5 text-[11px] font-medium text-text-primary shadow";
        tag.textContent = `${id.replace("tms:", "")} ${s.road} ${s.name.split("_").slice(1).join(" ")}`;
        el.append(dot, tag);
        new maplibregl.Marker({ element: el }).setLngLat([s.lon, s.lat]).addTo(map);
      }
      setReady(true);
    });
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [file]);

  // Routes: vt3's section clickable while open, red dashed where closed; st130 by % full; the western route grey
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const dirs = closed ? closedDirs(closed) : [];
    const features: GeoJSON.Feature[] = [];
    for (const d of [1, 2] as Dir[]) {
      const entry = file.options.a.directions[DIRECTION_NAME[d]];
      features.push(line(entry.routes.western.polyline, { kind: "western" }));
      features.push(line(entry.routes.st130.polyline, { kind: "st130", color: fullColor(pctFull[d]) }));
      const vt3 = entry.routes.vt3;
      const closable = section(vt3.polyline, vt3.length_m / 1000, entry.station_440.closed_from_km, entry.station_440.closed_to_km);
      if (!closed) features.push(line(closable, { kind: "vt3_closable" }));
      else if (dirs.includes(d)) features.push(line(closable, { kind: "vt3_closed" }));
      else features.push(line(vt3.polyline, { kind: "vt3_open" }));
    }
    (map.getSource("routes") as maplibregl.GeoJSONSource).setData({ type: "FeatureCollection", features });
    if (closed) map.getCanvas().style.cursor = "";
  }, [ready, file, pctFull, closed]);

  // Frame all routes and the three stations once; the padding keeps them clear of the left panel and leaves room for
  // the station labels on the right, so nothing is cut off at the map's edge
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const pts: [number, number][] = [
      ...Object.values(file.options.a.directions).flatMap((e) => [...e.routes.st130.polyline, ...e.routes.western.polyline, ...e.routes.vt3.polyline]),
      ...Object.values(file.stations).map((s) => [s.lat, s.lon] as [number, number]),
    ];
    const b = pts.reduce((acc, [lat, lon]) => acc.extend([lon, lat]), new maplibregl.LngLatBounds([pts[0][1], pts[0][0]], [pts[0][1], pts[0][0]]));
    const wide = map.getContainer().clientWidth >= 720;
    map.fitBounds(b, { padding: { top: 40, bottom: 40, left: wide ? 330 : 40, right: wide ? 170 : 40 }, duration: 0 });
  }, [ready, file]);

  return <div ref={containerRef} className="h-full w-full" />;
}

/* ---------- view ---------- */

const CLOSED: { value: Closed; label: string }[] = [
  { value: "north", label: "North" },
  { value: "south", label: "South" },
  { value: "both", label: "Both" },
];

const TYPICAL = "typical";

export function ClosureView() {
  const [file, setFile] = useState<LimitFile | null>(null);
  const [days, setDays] = useState<ClosureDays | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [closed, setClosed] = useState<Closed | null>(null);
  const [when, setWhen] = useState<string>(TYPICAL);
  const [hour, setHour] = useState(7);
  const [divert, setDivert] = useState(100);
  const [st130Pct, setSt130Pct] = useState(100);
  const [capacity, setCapacity] = useState<CapacityLevel>("mid");
  const [limitStep, setLimitStep] = useState(0);
  const [surface, setSurface] = useState<Surface>("dry");

  useEffect(() => {
    let cancelled = false;
    const load = async <T,>(name: string): Promise<T> => {
      const r = await fetch(`${import.meta.env.BASE_URL}${name}`);
      if (!r.ok) throw new Error(`${name}: HTTP ${r.status}`);
      return (await r.json()) as T;
    };
    load<LimitFile>("closure_lempaala.json")
      .then((f) => !cancelled && setFile(f))
      .catch((e: unknown) => !cancelled && setError(`${e instanceof Error ? e.message : String(e)} — copy it from aiko-fintraffic/analysis/outputs into public/`));
    // Optional: without the days file only the typical weekday is offered
    load<ClosureDays>("closure_lempaala_days.json")
      .then((d) => !cancelled && setDays(d))
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  if (error) return <div className="m-4 rounded-lg border border-traffic-heavy/40 bg-traffic-heavy/10 px-4 py-3 text-sm text-traffic-heavy">{error}</div>;
  if (!file)
    return (
      <div className="flex items-center gap-2 px-4 py-10 text-sm text-text-muted">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading the closure model…
      </div>
    );

  // When: the typical weekday, or one day's measured volumes (days without a complete hour and incomplete hours are disabled)
  const dayIndex = when !== TYPICAL && days ? days.dates.indexOf(when) : -1;
  const isDay = dayIndex >= 0 && days !== null;
  const hourIncomplete = (d: number, h: number) => (days ? incompleteStations(days, d, h).length > 0 : true);
  const dayUsable = (d: number) => Array.from({ length: 24 }, (_, h) => h).some((h) => !hourIncomplete(d, h));
  const blocked = isDay && hourIncomplete(dayIndex, hour);
  const input = isDay ? fileForDay(file, days, dayIndex) : file;
  const whenLabel = isDay ? `${dayLabel(when)}, ${hourLabel(hour)}` : `typical weekday ${hourLabel(hour)}`;

  // st130 speed limit, applied after the model (closureLimit.ts)
  const limitNow = st130CurrentLimit(file);
  const coef = file.speed_limit_effect?.speed_per_kmh[surface];
  const canStep = (s: number) => limitNow !== null && s >= -LIMIT_STEP && s <= LIMIT_STEP && limitNow.kmh + s >= LIMIT_RANGE.min && limitNow.kmh + s <= LIMIT_RANGE.max;
  const step = canStep(limitStep) ? limitStep : 0;

  const before = closureBefore(input, hour, capacity);
  const rows: LimitedRow[] | null = closed
    ? applySt130Limit(file, closureScenario(input, { hour, closed, divert: divert / 100, st130Share: st130Pct / 100, capacity }), step, surface)
    : null;
  const pctFull = { 1: rows ? rows[0].pct_full : before[1].pct_full, 2: rows ? rows[1].pct_full : before[2].pct_full };

  // Hover texts (from the file)
  const source = (id: string) => file.sources.find((s) => s.id === id)?.text ?? "";
  const capTitle = (level: CapacityLevel) => (level === "high" ? source("hcm2000_capacity") : source("summala1986"));
  const volumeMeasured = isDay ? `${days?.definition.volume ?? "LAM volume"}, ${dayLabel(when)}` : file.measured_vs_assumed.measured[0];
  const volumeEffect = file.speed_limit_effect?.volume.per_kmh;
  const noVolumeEffect = volumeEffect
    ? `; limit changes did not change volume (measured: ${volumeEffect.estimate} ${volumeEffect.unit}, 95 % CI ${volumeEffect.ci_low} … ${volumeEffect.ci_high})`
    : "";
  const limitEffectTitle = coef
    ? `effect measured on other roads: ${coef.estimate} ${coef.unit} on a ${surface} road (95 % CI ${coef.ci_low} … ${coef.ci_high}, n ${coef.n}); ${file.speed_limit_effect?.where_measured}`
    : "";

  // Headline from the numbers
  const range = (vals: number[]) => {
    const lo = Math.min(...vals).toFixed(0);
    const hi = Math.max(...vals).toFixed(0);
    return lo === hi ? lo : `${lo}–${hi}`;
  };
  let headline: string;
  if (!closed) headline = `Normal traffic, ${whenLabel} (measured). Click vt3 on the map to close it.`;
  else {
    const dirs = closedDirs(closed);
    const onSt130 = rows!.filter((r) => dirs.includes(r.direction) && r.added_veh_h > 0);
    const westernTotal = rows!.reduce((sum, r) => sum + r.western_added_veh_h, 0);
    const closedText = { north: "northbound", south: "southbound", both: "both ways" }[closed];
    const limitClause = step !== 0 && limitNow ? `, st130 limit ${limitNow.kmh} → ${limitNow.kmh + step} km/h` : "";
    const names = (rs: DirectionRow[]) => rs.map((r) => DIRECTION_NAME[r.direction]).join(" and ");
    const stable = onSt130.filter((r) => r.pct_full <= 100);
    const over = onSt130.filter((r) => r.pct_full > 100);
    const clauses = [
      `st130 gets ${onSt130.map((r, i) => `${signed(r.added_veh_h)}${i === 0 ? " veh/h" : ""} ${DIRECTION_NAME[r.direction]}`).join(" and ")}`,
      `${range(onSt130.map((r) => r.pct_full))} % full`,
    ];
    if (stable.length) clauses.push(`~${range(stable.map((r) => r.speed_stable_kmh))} km/h${over.length ? ` ${names(stable)}` : ""} if traffic stays stable`);
    if (over.length)
      clauses.push(
        `${over.length === onSt130.length ? "over capacity" : `${names(over)} over capacity`}: a queue of up to ${veh(Math.max(...over.map((r) => r.queue_end_of_hour_veh)))} vehicles forms this hour`,
      );
    headline =
      onSt130.length === 0
        ? `Vt3 closed ${closedText}, ${whenLabel}${limitClause}: all diverted traffic takes the western route (+${veh(westernTotal)} veh/h, no reliable counts) (model)`
        : `Vt3 closed ${closedText}, ${whenLabel}${limitClause}: ${clauses.join(", ")} (model)`;
  }

  const vt3Volume = (d: Dir) => input.stations["tms:440"].directions[String(d) as "1" | "2"].measured.volume_median_veh_h[hour] ?? 0;
  const towards = (d: Dir) => file.stations["tms:433"].directions[String(d) as "1" | "2"].towards;

  /** One st130 direction: volume, % full, speed, extra trip time; breakdown and queue lines only when they apply. */
  const directionBlock = (d: Dir, b: St130Result, after: LimitedRow | null) => {
    const pct = after ? after.pct_full : b.pct_full;
    const over = pct > 100;
    const slower = after && !after.direction_closed && after.speed_stable_kmh < b.speed_stable_kmh;
    const cap = after ? after.capacity : b.capacity;
    return (
      <div key={d} className="space-y-1 border-t border-border-subtle pt-2 text-xs text-text-secondary">
        <div className="flex items-center justify-between">
          <span className="font-medium text-text-primary">
            st130 {DIRECTION_NAME[d]} <span className="font-normal text-text-muted">(towards {towards(d)})</span>
          </span>
          {after && <span className={cn("text-[10px]", after.direction_closed ? "text-traffic-heavy" : "text-text-muted")}>{after.direction_closed ? "vt3 closed" : "vt3 open"}</span>}
        </div>
        <div className="flex justify-between gap-2">
          <span>Volume</span>
          <span className="font-mono">
            {veh(b.volume_before_veh_h)}
            <Dot measured title={volumeMeasured} />
            {after && (
              <>
                {" "}
                → {veh(after.volume_after_veh_h)}
                <Dot measured={false} title={`${file.model.demand}${step !== 0 ? noVolumeEffect : ""}`} />
              </>
            )}{" "}
            veh/h
          </span>
        </div>
        <div className="flex justify-between gap-2">
          <span>Full</span>
          <span>
            <FullBar pct={pct} title={`of ${veh(cap)} ${b.capacity_unit} capacity`} />
            <Dot measured={false} title={`capacity ${veh(cap)} ${b.capacity_unit}: ${capTitle(capacity)}`} />
          </span>
        </div>
        <div className="flex justify-between gap-2">
          <span>Speed</span>
          <span className="font-mono">
            {b.speed_stable_kmh.toFixed(0)}
            <Dot measured title={file.model.speed.measured_part} />
            {after && (
              <>
                {" "}
                → {over ? "at capacity " : ""}~{after.speed_stable_kmh.toFixed(0)}
                <Dot
                  measured={false}
                  title={`${file.model.speed.assumed_part}${
                    after.limit_effect_kmh !== 0
                      ? `; st130 limit ${after.limit_effect_kmh > 0 ? "+" : "−"}${Math.abs(after.limit_effect_kmh).toFixed(1)} km/h, ${limitEffectTitle}`
                      : ""
                  }`}
                />
              </>
            )}{" "}
            km/h
          </span>
        </div>
        {after && after.extra_trip_time_min !== null && (
          <div className="flex justify-between gap-2">
            <span>Extra trip time</span>
            <span className="font-mono">
              {after.extra_trip_time_min >= 0 ? "+" : "−"}
              {Math.abs(after.extra_trip_time_min).toFixed(1)} min
              <Dot measured={false} title={file.model.extra_trip_time} />
            </span>
          </div>
        )}
        {after && !over && after.speed_if_breakdown_kmh !== null && <div className="text-traffic-moderate">If flow breaks down: ~{after.speed_if_breakdown_kmh} km/h</div>}
        {after && over && (
          <div className="text-traffic-heavy">
            Over capacity: queue of {veh(after.queue_end_of_hour_veh)} vehicles by the end of the hour, average delay {after.avg_queue_delay_min.toFixed(1)} min
            (this hour only); inside the queue much lower (~{file.model.breakdown.speed_kmh} km/h seen in Finnish measurements)
            <Dot measured={false} title={`${file.model.queue.label}: ${file.model.queue.carry_over}`} />
            {after.limit_no_throughput && (
              <div className="text-text-secondary">{step > 0 ? "A higher limit doesn't let more cars through." : "A lower limit doesn't change how many cars get through."}</div>
            )}
          </div>
        )}
        {slower && <div className="text-text-muted">More oncoming traffic, fewer chances to overtake.</div>}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-bg-base text-text-primary">
      <header className="border-b border-border-subtle bg-bg-panel/60 px-4 py-3 backdrop-blur">
        <h1 className="text-base font-semibold">AIKO · Road closure (model) · vt3 Lempäälä</h1>
      </header>
      <div className="flex items-center gap-2 border-b border-traffic-moderate/40 bg-traffic-moderate/10 px-4 py-2 text-xs text-traffic-moderate">
        <AlertTriangle className="h-3.5 w-3.5 shrink-0" /> {CLOSURE_BANNER}
      </div>

      <main className="grid grid-cols-1 gap-4 p-4 lg:grid-cols-12">
        <div className="relative h-[78vh] min-h-[460px] overflow-hidden rounded-xl border border-border-subtle lg:col-span-8">
          <ClosureMap file={file} pctFull={pctFull} closed={closed} onCloseVt3={() => setClosed("both")} />

          {/* Left panel */}
          <div className="absolute left-3 top-3 max-h-[calc(100%-1.5rem)] w-[min(300px,calc(100%-4.5rem))] space-y-2.5 overflow-y-auto rounded-lg bg-bg-panel/95 p-2.5 text-[11px] text-text-secondary shadow">
            <div>
              <div className="mb-0.5">When</div>
              <div className="flex gap-1.5">
                <select
                  value={when}
                  onChange={(e) => setWhen(e.target.value)}
                  className="h-6 min-w-0 flex-1 rounded border border-border-subtle bg-bg-base px-1 text-[11px] text-text-primary"
                  aria-label="Day"
                >
                  <option value={TYPICAL}>Typical weekday</option>
                  {days?.dates.map((d, i) => (
                    <option key={d} value={d} disabled={!dayUsable(i)}>
                      {dayLabel(d)} · {DAY_TYPE_LABEL[days.day_types[i]] ?? days.day_types[i]}
                      {dayUsable(i) ? "" : " · no data"}
                    </option>
                  ))}
                </select>
                <select
                  value={hour}
                  onChange={(e) => setHour(Number(e.target.value))}
                  className="h-6 rounded border border-border-subtle bg-bg-base px-1 text-[11px] text-text-primary"
                  aria-label="Hour"
                >
                  {Array.from({ length: 24 }, (_, h) => (
                    <option key={h} value={h} disabled={isDay && hourIncomplete(dayIndex, h)}>
                      {hourLabel(h)}
                      {isDay && hourIncomplete(dayIndex, h) ? " · incomplete" : ""}
                    </option>
                  ))}
                </select>
              </div>
              {isDay && <div className="mt-0.5 text-[10px] text-text-muted">Volumes measured that day; speed curves and heavy-vehicle shares typical.</div>}
            </div>

            <div>
              <div className="mb-0.5">st130 speed limit</div>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setLimitStep(step - LIMIT_STEP)}
                  disabled={!canStep(step - LIMIT_STEP)}
                  className="h-6 w-10 rounded border border-border-subtle bg-bg-base font-mono text-[11px] text-text-primary disabled:opacity-35"
                >
                  −{LIMIT_STEP}
                </button>
                <span
                  className="flex-1 text-center font-mono text-text-primary"
                  title={limitNow ? `now ${limitNow.kmh} km/h: ${file.speed_limit_effect?.st130_current_limit_note}` : ""}
                >
                  {limitNow ? limitNow.kmh + step : "?"} km/h
                </span>
                <button
                  onClick={() => setLimitStep(step + LIMIT_STEP)}
                  disabled={!canStep(step + LIMIT_STEP)}
                  className="h-6 w-10 rounded border border-border-subtle bg-bg-base font-mono text-[11px] text-text-primary disabled:opacity-35"
                >
                  +{LIMIT_STEP}
                </button>
              </div>
            </div>

            <div>
              <div className="mb-0.5">vt3 closure</div>
              {closed ? (
                <div className="flex gap-1.5">
                  <div className="flex-1">
                    <Toggle options={CLOSED} value={closed} onChange={setClosed} />
                  </div>
                  <button onClick={() => setClosed(null)} className="rounded-md border border-border-subtle bg-bg-base px-2 text-[11px] font-medium text-text-primary hover:border-accent">
                    Reopen
                  </button>
                </div>
              ) : (
                <div className="text-text-muted">Click vt3 on the map to close it.</div>
              )}
            </div>

            <details className="group border-t border-border-subtle pt-2">
              <summary className="flex cursor-pointer list-none items-center gap-1 text-text-secondary hover:text-text-primary">
                <ChevronRight className="h-3 w-3 transition-transform group-open:rotate-90" /> Assumptions
              </summary>
              <div className="mt-2 space-y-2">
                <label className="block">
                  <span className="flex justify-between">
                    <span>Traffic that diverts</span>
                    <span className="font-mono text-text-primary">{divert} %</span>
                  </span>
                  <input type="range" min={50} max={100} step={5} value={divert} onChange={(e) => setDivert(Number(e.target.value))} className="w-full accent-[#3b82f6]" />
                </label>
                <label className="block">
                  <span className="flex justify-between">
                    <span>Split st130 / western</span>
                    <span className="font-mono text-text-primary">
                      {st130Pct} / {100 - st130Pct} %
                    </span>
                  </span>
                  <input type="range" min={0} max={100} step={5} value={st130Pct} onChange={(e) => setSt130Pct(Number(e.target.value))} className="w-full accent-[#3b82f6]" />
                </label>
                <div>
                  <div className="mb-0.5">st130 capacity per direction</div>
                  <Toggle
                    options={(["low", "mid", "high"] as CapacityLevel[]).map((level) => ({
                      value: level,
                      label: `${file.model.capacity[level].value.toLocaleString("en")}${file.model.capacity[level].unit === "pc/h" ? " pc/h" : ""}`,
                      title: capTitle(level),
                    }))}
                    value={capacity}
                    onChange={setCapacity}
                  />
                </div>
                <div>
                  <div className="mb-0.5">Road surface (only for the speed-limit effect)</div>
                  <Toggle
                    options={[
                      { value: "dry" as Surface, label: "Dry" },
                      { value: "wet" as Surface, label: "Wet" },
                    ]}
                    value={surface}
                    onChange={setSurface}
                  />
                </div>
              </div>
            </details>

            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 border-t border-border-subtle pt-1.5 text-[10px]">
              <span className="flex items-center gap-1">
                <span className="h-1 w-4 rounded" style={{ backgroundColor: VT3_CLOSABLE }} /> vt3 (click to close)
              </span>
              <span className="flex items-center gap-1">
                <span className="w-4 border-t-2 border-dashed border-[#ef4444]" /> closed
              </span>
              <span className="flex items-center gap-1">
                <span className="h-1 w-4 rounded bg-[#22c55e]" />
                <span className="h-1 w-4 rounded bg-[#eab308]" />
                <span className="h-1 w-4 rounded bg-[#ef4444]" /> st130 % full
              </span>
              <span className="flex items-center gap-1">
                <span className="h-1 w-4 rounded bg-[#9aa7bd]" /> western route
              </span>
            </div>
          </div>
        </div>

        {/* Results card */}
        <section className="space-y-3 self-start rounded-xl border border-border-subtle bg-bg-panel p-4 lg:col-span-4">
          {blocked ? (
            <p className="text-sm text-traffic-moderate">
              {dayLabel(when)}, {hourLabel(hour)}: data incomplete at{" "}
              {incompleteStations(days!, dayIndex, hour)
                .map((m) => `${m.point.replace("tms:", "")} (${m.observed === null ? "no data" : `${Math.round(m.observed * 100)} % observed`})`)
                .join(", ")}
              ; not computed.
            </p>
          ) : (
            <>
              <p className="text-sm font-semibold leading-snug">{headline}</p>
              {!closed && (
                <div className="space-y-1 border-t border-border-subtle pt-2 text-xs text-text-secondary">
                  <div className="font-medium text-text-primary">vt3 at 440 Lippo</div>
                  {([1, 2] as Dir[]).map((d) => (
                    <div key={d} className="flex justify-between gap-2">
                      <span>{DIRECTION_NAME[d]}</span>
                      <span className="font-mono">
                        {veh(vt3Volume(d))} veh/h
                        <Dot measured title={volumeMeasured} />
                      </span>
                    </div>
                  ))}
                </div>
              )}
              {([1, 2] as Dir[]).map((d) => directionBlock(d, before[d], rows ? rows.find((r) => r.direction === d)! : null))}
              {rows && (
                <div className="border-t border-border-subtle pt-2 text-xs text-text-secondary">
                  Western route: {rows.map((r) => `${signed(r.western_added_veh_h)} ${DIRECTION_NAME[r.direction]}`).join(", ")} veh/h (no reliable counts)
                  <Dot measured={false} title={file.model.demand} />
                </div>
              )}
              <div className="flex items-center gap-3 border-t border-border-subtle pt-2 text-[10px] text-text-muted">
                <span className="flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: MEASURED }} /> measured
                </span>
                <span className="flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: MODELLED }} /> modelled
                </span>
                <span>· hover a dot for its source</span>
              </div>
            </>
          )}
        </section>
      </main>
    </div>
  );
}
