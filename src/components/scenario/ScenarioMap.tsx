import { useEffect, useRef, useState } from "react";
import maplibregl, { Map as MlMap } from "maplibre-gl";
import type { Station } from "@/types/scenario";
import { placeName, roadName } from "@/utils/scenario";

/** OpenStreetMap raster tiles, desaturated so the scenario marks stand out. */
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
  layers: [
    { id: "osm", type: "raster", source: "osm", paint: { "raster-saturation": -0.9, "raster-brightness-max": 0.85, "raster-contrast": -0.1 } },
  ],
};

const BLUE = "#3b82f6";

interface Props {
  stations: Station[];
  selected: Station | undefined;
  afterZone: Station | null;
  sign: { id: string; lat: number; lon: number } | null;
  /** The number on the governing sign: the new limit, or "?" when the limit is unknown. */
  signText: string;
  signTitle: string;
  /** The direction's path along the road ([lat, lon], from public/scenario_paths.json), or null: markers only. */
  path: [number, number][] | null;
  /** The speed change at the selected station (marker 2) and the next station (marker 3), e.g. "−2.9 km/h"; null: no badge. */
  stationChange: string | null;
  downstreamChange: string | null;
  onSelectStation: (pointId: string) => void;
}

type Coord = [number, number];
const at = (p: { lat: number; lon: number }): Coord => [p.lon, p.lat];
const stationLabel = (s: Station) => `${placeName(s)} ${s.tms_number}`;

/** A marker element: the mark centred on the point, its label to the right and an optional change badge to the left. */
function markerElement(mark: HTMLElement, label: string | null, change: string | null = null): HTMLElement {
  const el = document.createElement("div");
  el.className = "relative";
  el.appendChild(mark);
  if (change) {
    const badge = document.createElement("div");
    badge.className =
      "pointer-events-none absolute right-full top-1/2 mr-1.5 -translate-y-1/2 whitespace-nowrap rounded px-1.5 py-0.5 text-[11px] font-semibold text-white shadow tabular-nums";
    badge.style.backgroundColor = BLUE;
    badge.textContent = change;
    el.appendChild(badge);
  }
  if (label) {
    const tag = document.createElement("div");
    tag.className =
      "pointer-events-none absolute left-full top-1/2 ml-1.5 -translate-y-1/2 whitespace-nowrap rounded bg-bg-panel/95 px-1.5 py-0.5 text-[11px] font-medium text-text-primary shadow";
    tag.textContent = label;
    el.appendChild(tag);
  }
  return el;
}

/** A blue numbered disc (2 = selected station, 3 = next station). */
function numberMark(n: number, size: "lg" | "md"): HTMLElement {
  const mark = document.createElement("div");
  mark.className = `flex items-center justify-center rounded-full border-2 border-white font-bold text-white shadow-lg ${size === "lg" ? "h-7 w-7 text-sm" : "h-6 w-6 text-xs"}`;
  mark.style.backgroundColor = BLUE;
  mark.textContent = String(n);
  return mark;
}

/**
 * Numbered markers show the selected section (1 sign, 2 station, 3 next station). Straight lines between them would cut
 * across buildings, so a line is drawn only when the direction has a real path along the road (scenario_paths.json).
 */
export function ScenarioMap({ stations, selected, afterZone, sign, signText, signTitle, path, stationChange, downstreamChange, onSelectStation }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MlMap | null>(null);
  const [ready, setReady] = useState(false);
  // Map handlers are bound once; they read the latest callback through this ref
  const onSelectRef = useRef(onSelectStation);
  onSelectRef.current = onSelectStation;

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: MAP_STYLE,
      center: [23.76, 61.45],
      zoom: 10,
      attributionControl: { compact: true },
    });
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
    map.addControl(new maplibregl.ScaleControl({ unit: "metric" }), "bottom-left");
    map.on("load", () => {
      map.addSource("path", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
      map.addLayer({ id: "path-glow", type: "line", source: "path", paint: { "line-color": BLUE, "line-width": 11, "line-opacity": 0.25, "line-blur": 2 } });
      map.addLayer({ id: "path", type: "line", source: "path", paint: { "line-color": BLUE, "line-width": 4.5 } });
      map.addSource("stations", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
      map.addLayer({
        id: "stations",
        type: "circle",
        source: "stations",
        paint: { "circle-radius": 4, "circle-color": "#9aa7bd", "circle-opacity": 0.7, "circle-stroke-color": "#0a0e14", "circle-stroke-width": 1 },
      });
      const hover = new maplibregl.Popup({ closeButton: false, closeOnClick: false, offset: 10 });
      map.on("mouseenter", "stations", (e) => {
        map.getCanvas().style.cursor = "pointer";
        const f = e.features?.[0];
        if (f && f.geometry.type === "Point") hover.setLngLat(f.geometry.coordinates as Coord).setText(String(f.properties?.label ?? "")).addTo(map);
      });
      map.on("mouseleave", "stations", () => {
        map.getCanvas().style.cursor = "";
        hover.remove();
      });
      map.on("click", "stations", (e) => {
        const id = e.features?.[0]?.properties?.point_id;
        if (typeof id === "string") onSelectRef.current(id);
      });
      setReady(true);
    });
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  const selectedId = selected?.point_id ?? null;
  const afterZoneId = afterZone?.point_id ?? null;

  // The other stations as small grey dots (the selected and next stations have their own markers)
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const marked = new Set([selectedId, afterZoneId]);
    (map.getSource("stations") as maplibregl.GeoJSONSource).setData({
      type: "FeatureCollection",
      features: stations
        .filter((s) => !marked.has(s.point_id))
        .map((s) => ({
          type: "Feature",
          geometry: { type: "Point", coordinates: at(s) },
          properties: {
            point_id: s.point_id,
            label: `${roadName(s)} · ${stationLabel(s)}${s.directions.some((d) => d.governing_sign) ? "" : " · no speed-limit sign data"}`,
          },
        })),
    });
  }, [ready, stations, selectedId, afterZoneId]);

  // The highlighted path along the road, when there is one
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    (map.getSource("path") as maplibregl.GeoJSONSource).setData({
      type: "FeatureCollection",
      features:
        path && path.length > 1
          ? [{ type: "Feature", geometry: { type: "LineString", coordinates: path.map(([lat, lon]) => [lon, lat]) }, properties: {} }]
          : [],
    });
  }, [ready, path]);

  // Markers: 1 sign (with the new limit), 2 selected station, 3 next station
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const markers: maplibregl.Marker[] = [];
    const add = (el: HTMLElement, p: { lat: number; lon: number }) => markers.push(new maplibregl.Marker({ element: el }).setLngLat(at(p)).addTo(map));

    if (afterZone) add(markerElement(numberMark(3, "md"), stationLabel(afterZone), downstreamChange), afterZone);
    if (selected) add(markerElement(numberMark(2, "lg"), stationLabel(selected), stationChange), selected);
    if (sign) {
      const mark = document.createElement("div");
      mark.className = "relative flex h-9 w-9 items-center justify-center rounded-full border-[4px] border-[#ef4444] bg-white text-xs font-bold text-black shadow-lg";
      mark.textContent = signText;
      mark.title = signTitle;
      const badge = document.createElement("span");
      badge.className = "absolute -left-2 -top-2 flex h-4 w-4 items-center justify-center rounded-full border border-white text-[9px] font-bold text-white";
      badge.style.backgroundColor = BLUE;
      badge.textContent = "1";
      mark.appendChild(badge);
      add(markerElement(mark, sign.id.replace("sign:", "Sign ")), sign);
    }
    return () => markers.forEach((m) => m.remove());
  }, [ready, selected, afterZone, sign, signText, signTitle, stationChange, downstreamChange]);

  // Fit markers 1-3 (and the path, when there is one) when a station is picked, so the whole section is visible at once
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready || !selected) return;
    const points: Coord[] = [
      at(selected),
      ...(sign ? [at(sign)] : []),
      ...(afterZone ? [at(afterZone)] : []),
      ...(path ?? []).map(([lat, lon]) => [lon, lat] as Coord),
    ];
    const bounds = points.reduce((b, p) => b.extend(p), new maplibregl.LngLatBounds(points[0], points[0]));
    // extra room on the right for the marker labels and on the left for the change badges, so they stay inside the map
    map.fitBounds(bounds, { padding: { top: 60, bottom: 60, left: 110, right: 190 }, maxZoom: 13, duration: 700 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, selectedId, afterZoneId, path]);

  const badge = (n: number) => (
    <span className="flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-bold text-white" style={{ backgroundColor: BLUE }}>
      {n}
    </span>
  );
  return (
    <div className="relative h-full w-full overflow-hidden rounded-xl border border-border-subtle">
      <div ref={containerRef} className="h-full w-full" />
      <div className="pointer-events-none absolute left-3 top-3 flex flex-wrap items-center gap-x-2 gap-y-1 rounded-md bg-bg-panel/90 px-2.5 py-1.5 text-[11px] text-text-secondary shadow">
        {badge(1)} sign · {badge(2)} station · {badge(3)} next station
      </div>
    </div>
  );
}
