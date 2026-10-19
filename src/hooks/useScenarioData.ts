import { useEffect, useState } from "react";
import type { ScenarioData, ScenarioModel } from "@/types/scenario";

interface State {
  model: ScenarioModel | null;
  data: ScenarioData | null;
  error: string | null;
}

/**
 * Loads public/scenario_model.json and public/scenario_data.json: static files copied into the
 * app (served from its own origin), not fetched from SeaweedFS or the traffic API.
 */
export function useScenarioData(): State {
  const [state, setState] = useState<State>({ model: null, data: null, error: null });

  useEffect(() => {
    let cancelled = false;
    const base = import.meta.env.BASE_URL;
    const load = async <T,>(name: string): Promise<T> => {
      const response = await fetch(`${base}${name}`);
      if (!response.ok) throw new Error(`${name}: HTTP ${response.status}`);
      return (await response.json()) as T;
    };
    Promise.all([load<ScenarioModel>("scenario_model.json"), load<ScenarioData>("scenario_data.json")])
      .then(([model, data]) => !cancelled && setState({ model, data, error: null }))
      .catch((e: unknown) =>
        !cancelled &&
        setState({
          model: null,
          data: null,
          error: `${e instanceof Error ? e.message : String(e)} — copy the files from aiko-fintraffic/analysis/outputs into public/`,
        }),
      );
    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}
