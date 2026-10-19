import { useEffect, useState } from "react";
import { Loader2, X } from "lucide-react";
import { useScenarioData } from "@/hooks/useScenarioData";
import type { ScenarioSelection } from "@/types/scenario";
import {
  afterZoneStation,
  findCell,
  findDirection,
  findStation,
  formatEffect,
  isNoMeasurableChange,
  limitAt,
  limitDaysText,
  medianAt,
  primaryNote,
  scenarioSpeed,
  stepAllowed,
  STEP_KMH,
  type LimitStep,
} from "@/utils/scenario";
import { ScenarioMap } from "./ScenarioMap";
import { ScenarioPanel, roadOptions, type RoadOption } from "./ScenarioPanel";
import { HowWeKnow } from "./HowWeKnow";

/**
 * Optional public/scenario_paths.json: a path along the road per station direction, keyed "tms:449|1" (point id | TMS
 * direction), as [lat, lon] points from the governing sign to the next station. Not in the export yet.
 */
interface ScenarioPaths {
  paths: Record<string, { polyline: [number, number][]; source?: string }>;
}

/** Weekdays only, one 20 km/h step from the limit in force. */
interface ViewState {
  pointId: string;
  direction: 1 | 2;
  hour: number;
  road: ScenarioSelection["road"];
  step: LimitStep;
}

/** Opens on tms 449 (vt3 Tampere Sarankulma), direction 1, weekdays 07-08, lowering by 20 km/h on a dry road. */
const DEFAULT_STATE: ViewState = { pointId: "tms:449", direction: 1, hour: 7, road: "dry", step: -1 };
const FIRST_AREA = "Pirkanmaa";

export function ScenarioView() {
  const { model, data, error } = useScenarioData();
  const [state, setState] = useState<ViewState>(DEFAULT_STATE);
  const [area, setArea] = useState(FIRST_AREA);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [paths, setPaths] = useState<ScenarioPaths | null>(null);

  // Optional: without the file the map shows markers only
  useEffect(() => {
    let cancelled = false;
    fetch(`${import.meta.env.BASE_URL}scenario_paths.json`)
      .then((r) => (r.ok ? (r.json() as Promise<ScenarioPaths>) : null))
      .then((p) => !cancelled && p?.paths && setPaths(p))
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!drawerOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setDrawerOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [drawerOpen]);

  if (error) {
    return <div className="m-4 rounded-xl border border-border-subtle bg-bg-panel px-4 py-3 text-sm text-text-secondary">{error}</div>;
  }
  if (!model || !data) {
    return (
      <div className="flex items-center gap-2 px-4 py-10 text-sm text-text-muted">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading the scenario data…
      </div>
    );
  }

  const station = findStation(data, state.pointId);
  const direction = findDirection(station, state.direction);
  const current = limitAt(direction, { dayType: "weekday", hour: state.hour });
  // A step the limit at this hour can't take (outside 60-120) falls back to no change
  const step: LimitStep = stepAllowed(current, state.step) ? state.step : 0;
  const selection: ScenarioSelection = {
    pointId: state.pointId,
    direction: state.direction,
    dayType: "weekday",
    hour: state.hour,
    change: step > 0 ? "raised" : "lowered",
    sizeBin: "20",
    road: state.road,
  };
  const cell = findCell(model.cells, selection, selection.road);
  const downstreamCell = findCell(model.downstream.cells, selection, "any");
  const normal = direction?.normal.weekday;
  const speed = scenarioSpeed(medianAt(normal?.mean_speed_kmh, state.hour), cell?.metrics.mean_speed);
  const afterZone = afterZoneStation(data, direction) ?? null;
  const sign = direction?.governing_sign ?? null;

  const options = roadOptions(data);
  const areas = [...new Set(data.stations.map((s) => s.province).filter((p): p is string => Boolean(p)))].sort((a, b) =>
    a === FIRST_AREA ? -1 : b === FIRST_AREA ? 1 : a.localeCompare(b, "fi"),
  );
  const areaOptions = options.filter((o) => o.province === area);
  const pickRoad = (o: RoadOption) => setState({ ...state, pointId: o.pointId, direction: o.direction });
  // A station picked on the map: its listed direction (the current one when it has a sign); none listed, nothing happens
  const pickStation = (pointId: string) => {
    const listed = options.filter((o) => o.pointId === pointId);
    const option = listed.find((o) => o.direction === state.direction) ?? listed[0];
    if (!option) return;
    if (option.province) setArea(option.province);
    pickRoad(option);
  };
  const pickArea = (next: string) => {
    setArea(next);
    const first = options.find((o) => o.province === next);
    if (first) pickRoad(first);
  };

  const newLimitText = current === null ? "?" : String(current + step * STEP_KMH);
  // Map badges: the speed change at the station and downstream, only when a change is selected
  const speedUnit = model.metrics.mean_speed.unit;
  const stationStats = cell?.metrics.mean_speed;
  const downstreamStats = downstreamCell?.metrics.mean_speed;
  const stationChange = step !== 0 && stationStats && stationStats.n > 0 && stationStats.mean !== null ? formatEffect(stationStats.mean, "mean_speed", speedUnit) : null;
  const downstreamChange =
    step !== 0 && afterZone && downstreamStats && downstreamStats.n > 0 && downstreamStats.mean !== null
      ? isNoMeasurableChange(downstreamStats)
        ? "no measurable change"
        : formatEffect(downstreamStats.mean, "mean_speed", speedUnit)
      : null;

  return (
    <div className="min-h-screen bg-bg-base font-sans text-text-primary">
      <header className="flex flex-col gap-2 border-b border-border-subtle px-4 py-3 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-base font-semibold">AIKO · Speed-limit scenarios</h1>
          <select
            aria-label="Area"
            value={area}
            onChange={(e) => pickArea(e.target.value)}
            className="h-8 rounded-lg border border-border-subtle bg-bg-base px-2 text-sm text-text-primary"
          >
            {areas.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </div>
        <span className="rounded-full border border-border-subtle px-3 py-1 text-xs text-text-muted">
          Based on {model.n_comparisons} real limit changes, 23 Sep – 1 Oct 2026
        </span>
      </header>

      <main className="flex flex-col gap-4 p-4 lg:h-[calc(100vh-6.75rem)] lg:flex-row">
        <div className="h-[55vh] min-h-[360px] lg:h-full lg:w-3/5">
          <ScenarioMap
            stations={data.stations}
            selected={station}
            afterZone={afterZone}
            sign={sign}
            signText={newLimitText}
            signTitle={`${sign?.id.replace("sign:", "Sign ") ?? "Sign"}: ${current === null ? "limit unknown" : step === 0 ? `${current} km/h, no change` : `${current} → ${newLimitText} km/h`}`}
            path={paths?.paths[`${state.pointId}|${state.direction}`]?.polyline ?? null}
            stationChange={stationChange}
            downstreamChange={downstreamChange}
            onSelectStation={pickStation}
          />
        </div>
        <div className="lg:h-full lg:w-2/5 lg:overflow-y-auto">
          <ScenarioPanel
            model={model}
            options={areaOptions}
            selection={selection}
            step={step}
            current={current}
            limitDays={limitDaysText(direction, selection)}
            normal={normal}
            cell={cell}
            downstreamCell={downstreamCell}
            station={station}
            afterZone={afterZone}
            speed={speed}
            note={step !== 0 ? primaryNote(model, cell, direction, selection) : null}
            onRoad={pickRoad}
            onStep={(next) => setState({ ...state, step: next })}
            onChange={(patch) => setState({ ...state, ...patch })}
            onHowWeKnow={() => setDrawerOpen(true)}
          />
        </div>
      </main>

      {drawerOpen && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-black/50" onClick={() => setDrawerOpen(false)} />
          <aside role="dialog" aria-label="How we know" className="relative h-full w-full max-w-[560px] space-y-6 overflow-y-auto border-l border-border-subtle bg-bg-panel p-6 shadow-2xl">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-text-primary">How we know</h2>
              <button onClick={() => setDrawerOpen(false)} aria-label="Close" className="rounded-md p-1 text-text-muted hover:text-text-primary">
                <X className="h-4 w-4" />
              </button>
            </div>
            <HowWeKnow
              model={model}
              selection={selection}
              direction={direction}
              normal={normal}
              cell={cell}
              downstreamCell={downstreamCell}
              afterZone={afterZone}
              isChange={step !== 0}
            />
          </aside>
        </div>
      )}
    </div>
  );
}
