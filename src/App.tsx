import { useCallback, useEffect, useRef, useState } from "react";
import type {
  ApiConfig as ApiConfigType,
  DataMode,
  RequestDebugInfo,
  TrafficQueryParams,
  TrafficResponse,
} from "@/types/traffic";
import { fetchTrafficData } from "@/services/trafficApi";
import { pointAt } from "@/utils/traffic";

import { Header } from "@/components/Header";
import { TrafficMap } from "@/components/TrafficMap";
import { TrafficLegend } from "@/components/TrafficLegend";
import { TrafficStats } from "@/components/TrafficStats";
import { TimelineControls } from "@/components/TimelineControls";
import { TrafficSimulation } from "@/components/TrafficSimulation";
import { SpeedChart } from "@/components/SpeedChart";
import { RelativeSpeedChart } from "@/components/RelativeSpeedChart";
import { SegmentInfo } from "@/components/SegmentInfo";
import { SegmentTable } from "@/components/SegmentTable";
import { ApiConfig } from "@/components/ApiConfig";
import { ApiQueryPanel } from "@/components/ApiQueryPanel";
import { ApiDebugPanel } from "@/components/ApiDebugPanel";
import { ApiResponseExplorer } from "@/components/ApiResponseExplorer";
import { MlForecast } from "@/components/MlForecast";

const DEFAULT_URL =
  import.meta.env.VITE_TRAFFIC_API_URL ??
  "https://zlwvykyjtj.execute-api.eu-central-1.amazonaws.com/prod/api/v1/tomtom/location-impact";

export default function App() {
  const [config, setConfig] = useState<ApiConfigType>({
    apiUrl: DEFAULT_URL,
    apiKey: import.meta.env.VITE_TRAFFIC_API_KEY ?? "",
    mode: "live",
  });
  const [params, setParams] = useState<TrafficQueryParams>({
    latitude: 60.406352,
    longitude: 24.821962,
    date: "2026-06-05",
    time: "10:00",
    radius: 150,
    window: 20,
  });

  const [data, setData] = useState<TrafficResponse | null>(null);
  const [debug, setDebug] = useState<RequestDebugInfo | null>(null);
  const [loading, setLoading] = useState(false);

  const [selectedIndex, setSelectedIndex] = useState(0);
  const [selectedSegmentId, setSelectedSegmentId] = useState<string | null>(null);

  // Timeline auto-advance
  const [timelinePlaying, setTimelinePlaying] = useState(false);
  const timelineTimer = useRef<number | null>(null);

  // Vehicle simulation
  const [simPlaying, setSimPlaying] = useState(true);
  const [simSpeed, setSimSpeed] = useState(1);
  const [showVehicles, setShowVehicles] = useState(true);
  const [resetToken, setResetToken] = useState(0);

  const runFetch = useCallback(
    async (cfg: ApiConfigType, prms: TrafficQueryParams) => {
      setLoading(true);
      const result = await fetchTrafficData(cfg, prms);
      setData(result.data);
      setDebug(result.debug);
      setSelectedIndex(0);
      setSelectedSegmentId(null);
      setLoading(false);
    },
    [],
  );

  // Initial load + refetch whenever the data mode flips.
  useEffect(() => {
    runFetch(config, params);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config.mode]);

  // Timeline playback loop
  useEffect(() => {
    if (!timelinePlaying || !data || data.timeline.length === 0) return;
    timelineTimer.current = window.setInterval(() => {
      setSelectedIndex((i) => (i + 1) % data.timeline.length);
    }, 1100);
    return () => {
      if (timelineTimer.current) window.clearInterval(timelineTimer.current);
    };
  }, [timelinePlaying, data]);

  const timeline = data?.timeline ?? [];
  const currentPoint = pointAt(timeline, selectedIndex);
  const relativeSpeed = currentPoint?.relative_speed ?? null;
  const currentSpeed = currentPoint?.current_speed ?? 0;
  const segmentsFound = data?.segments.features.length ?? data?.meta.segments_found ?? 0;

  return (
    <div className="min-h-screen bg-bg-base text-text-primary">
      <Header
        mode={config.mode}
        onModeChange={(m: DataMode) => setConfig((c) => ({ ...c, mode: m }))}
        loading={loading}
        httpStatus={debug?.httpStatus ?? null}
        error={debug?.error ?? null}
        onRefresh={() => runFetch(config, params)}
      />

      <main className="mx-auto max-w-[1600px] space-y-4 p-4">
        {/* Stats row */}
        <TrafficStats point={currentPoint} segmentsFound={segmentsFound} />

        {/* Empty-timeline notice — but segments still shown */}
        {data && timeline.length === 0 && (
          <div className="rounded-lg border border-traffic-moderate/40 bg-traffic-moderate/10 px-4 py-2.5 text-sm text-traffic-moderate">
            No traffic observations available for this timestamp/window. Segments
            found: {segmentsFound} · Traffic observations: 0
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
          {/* Left / center: map + timeline + charts */}
          <div className="space-y-4 lg:col-span-8">
            <div className="space-y-2">
              {/* <div className="flex flex-wrap items-center justify-between gap-2">
                <TrafficLegend />
              </div> */}
              <div className="h-[380px] lg:h-[520px]">
                <TrafficMap
                  data={data}
                  relativeSpeed={relativeSpeed}
                  currentSpeed={currentSpeed}
                  selectedSegmentId={selectedSegmentId}
                  onSelectSegment={setSelectedSegmentId}
                  simPlaying={simPlaying}
                  simSpeed={simSpeed}
                  showVehicles={showVehicles}
                  resetToken={resetToken}
                />
              </div>
            </div>

            {/* <TimelineControls
              timeline={timeline}
              selectedIndex={selectedIndex}
              onSelectIndex={setSelectedIndex}
              playing={timelinePlaying}
              onTogglePlay={() => setTimelinePlaying((p) => !p)}
              onReset={() => {
                setTimelinePlaying(false);
                setSelectedIndex(0);
              }}
            /> */}

            <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
              <SpeedChart timeline={timeline} selectedIndex={selectedIndex} />
              <RelativeSpeedChart timeline={timeline} selectedIndex={selectedIndex} />
            </div>
          </div>

          {/* Right: info + controls */}
          <div className="space-y-4 lg:col-span-4">
            <SegmentInfo
              data={data}
              selectedSegmentId={selectedSegmentId}
              onClear={() => setSelectedSegmentId(null)}
            />
            <TrafficSimulation
              playing={simPlaying}
              onTogglePlay={() => setSimPlaying((p) => !p)}
              onReset={() => setResetToken((t) => t + 1)}
              simSpeed={simSpeed}
              onSpeedChange={setSimSpeed}
              showVehicles={showVehicles}
              onToggleVehicles={() => setShowVehicles((v) => !v)}
              currentSpeed={currentPoint ? currentSpeed : null}
            />
            {/* <MlForecast currentSpeed={currentPoint ? currentSpeed : null} /> */}
            {/* <ApiConfig config={config} onChange={setConfig} /> */}
            <ApiQueryPanel
              params={params}
              onChange={setParams}
              onFetch={() => runFetch(config, params)}
              loading={loading}
            />
          </div>
        </div>

        {/* Full-width: table, debug, explorer */}
        {/* <SegmentTable
          data={data}
          selectedSegmentId={selectedSegmentId}
          onSelectSegment={setSelectedSegmentId}
        /> */}
        {/* <ApiDebugPanel debug={debug} /> */}
        {/* <ApiResponseExplorer data={data} /> */}

        {/* <footer className="pb-6 pt-2 text-center text-xs text-text-muted">
          Smart Traffic Simulation · prototype for the AIKO traffic-analytics
          pipeline · aggregate speed data, simulated vehicles for illustration
          only
        </footer> */}
      </main>
    </div>
  );
}
