import type {
  ApiConfig,
  FetchResult,
  RequestDebugInfo,
  TrafficQueryParams,
  TrafficResponse,
} from "@/types/traffic";
import { mockTrafficData } from "@/data/mockTrafficData";

/** Build the fully-qualified request URL with query parameters. */
export function buildRequestUrl(apiUrl: string, params: TrafficQueryParams): string {
  const url = new URL(apiUrl);
  url.searchParams.set("lat", String(params.latitude));
  url.searchParams.set("lon", String(params.longitude));
  url.searchParams.set("date", params.date);
  url.searchParams.set("time", params.time);
  url.searchParams.set("radius_m", String(params.radius));
  url.searchParams.set("window_min", String(params.window));
  return url.toString();
}

/**
 * Minimal runtime validation. We don't want a slightly-off payload to crash the
 * UI, so we coerce to a safe shape and let the caller decide how to render an
 * empty timeline vs. missing segments.
 */
function normalizeResponse(raw: unknown): TrafficResponse | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Partial<TrafficResponse>;
  const segments =
    r.segments && r.segments.type === "FeatureCollection"
      ? r.segments
      : { type: "FeatureCollection" as const, features: [] };
  const timeline = Array.isArray(r.timeline) ? r.timeline : [];
  const location = r.location ?? { latitude: 0, longitude: 0, timestamp: "" };
  const meta =
    r.meta ??
    ({
      radius_m: 0,
      window_min: 0,
      segments_found: segments.features.length,
      offsets_min: timeline.map((t) => t.offset_min),
    } as TrafficResponse["meta"]);
  return { segments, timeline, meta, location };
}

/**
 * Fetch traffic data. In "mock" mode this returns the bundled sample after a
 * short simulated latency; in "live" mode it calls the configured endpoint with
 * the x-api-key header. Either way a full RequestDebugInfo record is returned so
 * the debug panel can show exactly what happened.
 */
export async function fetchTrafficData(
  config: ApiConfig,
  params: TrafficQueryParams,
): Promise<FetchResult> {
  const requestUrl = buildRequestUrl(config.apiUrl, params);
  const startedAt = performance.now();
  const baseDebug: RequestDebugInfo = {
    mode: config.mode,
    requestUrl,
    params,
    httpStatus: null,
    statusText: "",
    responseTimeMs: 0,
    segmentsFound: 0,
    timelineCount: 0,
    rawResponse: null,
    error: null,
    timestamp: new Date().toISOString(),
  };

  if (config.mode === "mock") {
    await new Promise((res) => setTimeout(res, 250));
    const data = mockTrafficData;
    return {
      data,
      debug: {
        ...baseDebug,
        requestUrl: "(mock) " + requestUrl,
        httpStatus: 200,
        statusText: "OK (mock)",
        responseTimeMs: Math.round(performance.now() - startedAt),
        segmentsFound: data.segments.features.length,
        timelineCount: data.timeline.length,
        rawResponse: data,
      },
    };
  }

  // ---- Live mode ----
  try {
    const res = await fetch(requestUrl, {
      method: "GET",
      headers: {
        "x-api-key": config.apiKey,
        Accept: "application/json",
      },
    });
    const responseTimeMs = Math.round(performance.now() - startedAt);

    let raw: unknown = null;
    let parseError: string | null = null;
    const text = await res.text();
    try {
      // segment_id can exceed Number.MAX_SAFE_INTEGER; quote it before parsing
      // so JSON.parse doesn't silently round it to a different value.
      const safeText = text.replace(/("segment_id"\s*:\s*)(\d+)/g, '$1"$2"');
      raw = safeText ? JSON.parse(safeText) : null;
    } catch {
      parseError = "Response body was not valid JSON.";
      raw = text;
    }

    if (!res.ok) {
      const hint =
        res.status === 401
          ? "Unauthorized — check the x-api-key in API Configuration."
          : res.status === 403
            ? "Forbidden — the key may lack access to this resource."
            : res.status === 404
              ? "Not found — check the API URL in API Configuration."
              : res.status === 429
                ? "Rate limited — too many requests, try again shortly."
                : res.status >= 500
                  ? `Server error (HTTP ${res.status}) — the API encountered a problem.`
                  : `Request failed with HTTP ${res.status}.`;
      return {
        data: null,
        debug: {
          ...baseDebug,
          httpStatus: res.status,
          statusText: res.statusText,
          responseTimeMs,
          rawResponse: raw,
          error: hint,
        },
      };
    }

    const data = normalizeResponse(raw);
    const emptyBodyError = raw == null ? "The API returned an empty response body." : null;
    return {
      data,
      debug: {
        ...baseDebug,
        httpStatus: res.status,
        statusText: res.statusText,
        responseTimeMs,
        segmentsFound: data?.segments.features.length ?? 0,
        timelineCount: data?.timeline.length ?? 0,
        rawResponse: raw,
        error: parseError ?? emptyBodyError ?? (data ? null : "Response did not match expected shape."),
      },
    };
  } catch (err) {
    // Network-level failure (CORS, DNS, offline, etc.)
    return {
      data: null,
      debug: {
        ...baseDebug,
        responseTimeMs: Math.round(performance.now() - startedAt),
        error:
          err instanceof Error
            ? `Network error: ${err.message}. If this is CORS, the endpoint may need to allow this origin, or route calls through a dev proxy.`
            : "Unknown network error.",
      },
    };
  }
}
