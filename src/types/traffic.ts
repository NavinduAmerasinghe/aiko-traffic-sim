/**
 * Type definitions for the TomTom location-impact traffic API.
 *
 * These interfaces are the single source of truth for the shape of the API
 * response. If the real endpoint's schema differs, adjust here and the rest of
 * the app (parsing, map, charts, tables) will surface the type errors for you.
 */

/** A single road-segment feature. Geometry is always a LineString. */
export interface SegmentProperties {
  segment_id: string;
  route_id: string;
  route_name: string;
  segment_length_m: number;
  dist_from_entity_m: number;
}

export interface SegmentGeometry {
  type: "LineString";
  /** GeoJSON order: [longitude, latitude] pairs. */
  coordinates: [number, number][];
}

export interface SegmentFeature {
  type: "Feature";
  properties: SegmentProperties;
  geometry: SegmentGeometry;
}

export interface SegmentCollection {
  type: "FeatureCollection";
  features: SegmentFeature[];
}

/** One observation in the traffic timeline. */
export interface TimelinePoint {
  offset_min: number;
  snapshot_time: string;
  segment_count: number;
  current_speed: number;
  typical_speed: number;
  /** Percentage: current_speed / typical_speed * 100 (roughly). */
  relative_speed: number;
}

export interface TrafficMeta {
  radius_m: number;
  window_min: number;
  segments_found: number;
  offsets_min: number[];
}

export interface TrafficLocation {
  latitude: number;
  longitude: number;
  timestamp: string;
}

/** Full response envelope returned by the endpoint. */
export interface TrafficResponse {
  segments: SegmentCollection;
  timeline: TimelinePoint[];
  meta: TrafficMeta;
  location: TrafficLocation;
}

/** Parameters accepted by the query endpoint. */
export interface TrafficQueryParams {
  latitude: number;
  longitude: number;
  /** YYYY-MM-DD */
  date: string;
  /** HH:mm (24h) */
  time: string;
  /** metres */
  radius: number;
  /** minutes */
  window: number;
}

export type DataMode = "mock" | "live";

export interface ApiConfig {
  apiUrl: string;
  apiKey: string;
  mode: DataMode;
}

/** Everything the debug panel needs to render, captured per request. */
export interface RequestDebugInfo {
  mode: DataMode;
  requestUrl: string;
  params: TrafficQueryParams;
  httpStatus: number | null;
  statusText: string;
  responseTimeMs: number;
  segmentsFound: number;
  timelineCount: number;
  rawResponse: unknown;
  error: string | null;
  timestamp: string;
}

/** Result of a fetch attempt — data may be null on error. */
export interface FetchResult {
  data: TrafficResponse | null;
  debug: RequestDebugInfo;
}

/** Traffic condition buckets derived from relative_speed. */
export type TrafficState = "free" | "moderate" | "slow" | "heavy" | "none";
