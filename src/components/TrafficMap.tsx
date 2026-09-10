import { useEffect, useRef, useState } from "react";
import maplibregl, { Map as MlMap, Popup } from "maplibre-gl";
import type { TrafficResponse } from "@/types/traffic";
import { boundsOfSegments } from "@/utils/geo";
import { trafficColor } from "@/utils/traffic";
import {
  advanceVehicles,
  buildRoutePaths,
  spawnVehicles,
  vehiclePositions,
  type RoutePath,
  type Vehicle,
} from "@/utils/simulation";

const ROUTE_PALETTE = ["#3b82f6", "#a855f7", "#06b6d4", "#ec4899", "#14b8a6"];
const VEHICLE_COUNT = 14;

const MAP_STYLE: maplibregl.StyleSpecification = {
  version: 8,
  sources: {
    osm: {
      type: "raster",
      tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
      tileSize: 256,
      maxzoom: 19,
      attribution:
        '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    },
  },
  layers: [{ id: "osm", type: "raster", source: "osm" }],
};

interface TrafficMapProps {
  data: TrafficResponse | null;
  relativeSpeed: number | null;
  currentSpeed: number;
  selectedSegmentId: string | null;
  onSelectSegment: (id: string | null) => void;
  simPlaying: boolean;
  simSpeed: number;
  showVehicles: boolean;
  resetToken: number;
}

/** Build a MapLibre "match" expression coloring each route from the palette. */
function routeColorExpression(data: TrafficResponse | null): maplibregl.ExpressionSpecification {
  const routes = data
    ? Array.from(new Set(data.segments.features.map((f) => f.properties.route_id)))
    : [];
  const cases: (string | string[])[] = [];
  routes.forEach((r, i) => {
    cases.push(r, ROUTE_PALETTE[i % ROUTE_PALETTE.length]);
  });
  return [
    "match",
    ["get", "route_id"],
    ...(cases.length ? cases : ["__none__", "#3b82f6"]),
    "#64748b",
  ] as unknown as maplibregl.ExpressionSpecification;
}

export function TrafficMap(props: TrafficMapProps) {
  const {
    data,
    relativeSpeed,
    currentSpeed,
    selectedSegmentId,
    onSelectSegment,
    simPlaying,
    simSpeed,
    showVehicles,
    resetToken,
  } = props;

  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MlMap | null>(null);
  const popupRef = useRef<Popup | null>(null);
  const [ready, setReady] = useState(false);

  // Simulation state lives in refs so the animation loop reads fresh values
  // without being torn down on every prop change.
  const pathsRef = useRef<RoutePath[]>([]);
  const vehiclesRef = useRef<Vehicle[]>([]);
  const rafRef = useRef<number | null>(null);
  const lastTsRef = useRef<number>(0);
  const liveProps = useRef({ simPlaying, simSpeed, currentSpeed, showVehicles });
  liveProps.current = { simPlaying, simSpeed, currentSpeed, showVehicles };

  // --- Init map once ---
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: MAP_STYLE,
      center: [24.821962, 60.406352],
      zoom: 13,
      attributionControl: { compact: true },
    });
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
    map.addControl(new maplibregl.ScaleControl({ unit: "metric" }), "bottom-left");
    mapRef.current = map;
    map.on("load", () => setReady(true));
    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // --- Push segment data + (re)build layers when data changes ---
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;

    const fc = (data?.segments ?? {
      type: "FeatureCollection",
      features: [],
    }) as unknown as GeoJSON.FeatureCollection;

    // Source: segments
    if (map.getSource("segments")) {
      (map.getSource("segments") as maplibregl.GeoJSONSource).setData(fc);
    } else {
      map.addSource("segments", { type: "geojson", data: fc });

      map.addLayer({
        id: "segments-casing",
        type: "line",
        source: "segments",
        layout: { "line-cap": "round", "line-join": "round" },
        paint: {
          "line-color": routeColorExpression(data),
          "line-width": 8,
          "line-opacity": 0.55,
        },
      });
      map.addLayer({
        id: "segments-core",
        type: "line",
        source: "segments",
        layout: { "line-cap": "round", "line-join": "round" },
        paint: {
          "line-color": trafficColor(relativeSpeed),
          "line-width": 3.5,
        },
      });
      map.addLayer({
        id: "segment-selected",
        type: "line",
        source: "segments",
        layout: { "line-cap": "round", "line-join": "round" },
        filter: ["==", ["get", "segment_id"], "__none__"],
        paint: { "line-color": "#ffffff", "line-width": 6, "line-opacity": 0.9 },
      });
      // Wide transparent hit target for easier clicking.
      map.addLayer({
        id: "segments-hit",
        type: "line",
        source: "segments",
        paint: { "line-color": "#000000", "line-width": 16, "line-opacity": 0 },
      });

      map.on("mouseenter", "segments-hit", () => {
        map.getCanvas().style.cursor = "pointer";
      });
      map.on("mouseleave", "segments-hit", () => {
        map.getCanvas().style.cursor = "";
      });
      map.on("click", "segments-hit", (e) => {
        const f = e.features?.[0];
        if (!f) return;
        const p = f.properties as Record<string, string>;
        onSelectSegment(String(p.segment_id));
        popupRef.current?.remove();
        popupRef.current = new maplibregl.Popup({ closeButton: true, offset: 12 })
          .setLngLat(e.lngLat)
          .setHTML(
            `<div style="font-size:12px;line-height:1.5">
               <div style="font-weight:600;margin-bottom:2px">${p.route_name ?? p.route_id}</div>
               <div style="color:#9aa7bd">Segment ${p.segment_id}</div>
               <div style="color:#9aa7bd">${p.segment_length_m} m · ${Number(
                 p.dist_from_entity_m,
               ).toFixed(1)} m from point</div>
             </div>`,
          )
          .addTo(map);
      });
    }

    // Update route colors + fit to data
    if (map.getLayer("segments-casing")) {
      map.setPaintProperty("segments-casing", "line-color", routeColorExpression(data));
    }

    const bounds = data ? boundsOfSegments(data.segments.features) : null;
    if (bounds) {
      map.fitBounds(bounds, { padding: 80, maxZoom: 16, duration: 600 });
    }

    // Rebuild simulation paths + vehicles for the new network.
    pathsRef.current = data ? buildRoutePaths(data.segments.features) : [];
    vehiclesRef.current = spawnVehicles(pathsRef.current, VEHICLE_COUNT);

    if (!map.getSource("vehicles")) {
      map.addSource("vehicles", {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      });
      map.addLayer({
        id: "vehicles-layer",
        type: "circle",
        source: "vehicles",
        paint: {
          "circle-radius": 4,
          "circle-color": "#e6edf5",
          "circle-stroke-color": "#0a0e14",
          "circle-stroke-width": 1.5,
          "circle-opacity": 0.95,
        },
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, ready]);

  // --- Recolor traffic core when the selected timeline point changes ---
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready || !map.getLayer("segments-core")) return;
    map.setPaintProperty("segments-core", "line-color", trafficColor(relativeSpeed));
  }, [relativeSpeed, ready]);

  // --- Selected segment highlight ---
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready || !map.getLayer("segment-selected")) return;
    map.setFilter("segment-selected", [
      "==",
      ["get", "segment_id"],
      selectedSegmentId ?? "__none__",
    ]);
  }, [selectedSegmentId, ready]);

  // --- Reset: re-spawn vehicles at fresh positions ---
  useEffect(() => {
    if (!ready) return;
    vehiclesRef.current = spawnVehicles(pathsRef.current, VEHICLE_COUNT);
  }, [resetToken, ready]);

  // --- Animation loop (mounted once map is ready) ---
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;

    const tick = (ts: number) => {
      const { simPlaying: playing, simSpeed: speed, currentSpeed: spd, showVehicles: show } =
        liveProps.current;
      const last = lastTsRef.current || ts;
      const dt = Math.min(0.1, (ts - last) / 1000); // clamp big gaps
      lastTsRef.current = ts;

      const src = map.getSource("vehicles") as maplibregl.GeoJSONSource | undefined;
      if (src) {
        if (show) {
          if (playing) {
            advanceVehicles(vehiclesRef.current, pathsRef.current, spd, speed, dt);
          }
          src.setData(
            vehiclePositions(vehiclesRef.current, pathsRef.current) as GeoJSON.FeatureCollection,
          );
        } else {
          src.setData({ type: "FeatureCollection", features: [] });
        }
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      lastTsRef.current = 0;
    };
  }, [ready]);

  return (
    <div className="relative h-full w-full overflow-hidden rounded-xl border border-border-subtle">
      <div ref={containerRef} className="h-full w-full" />
      {/* Simulation disclaimer overlay */}
      <div className="pointer-events-none absolute bottom-8 right-2 max-w-[280px] rounded-lg border border-border-subtle bg-bg-panel/90 px-3 py-2 text-[11px] leading-snug text-text-muted backdrop-blur">
        {/* Simulated vehicles based on observed aggregate traffic speed — not real
        individual vehicle positions. */}
            Note: Not real
        individual vehicle positions.
      </div>
    </div>
  );
}
