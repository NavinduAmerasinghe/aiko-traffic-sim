# Smart Traffic Simulation

Interactive prototype for visualizing the TomTom **location-impact** traffic API,
built as a front-end companion to the AIKO traffic-analytics pipeline. It runs on
bundled mock data immediately and switches to the live endpoint with a toggle.

> **On the data:** the API returns *aggregate* traffic speed per timestamp, not
> individual vehicle positions. The animated vehicles on the map are a visual
> aid derived from the observed aggregate speed — they are **not** real cars.

## Quick start

```bash
npm install
npm run dev          # http://localhost:5173  (opens in Mock Data mode)
```

Other scripts:

```bash
npm run build        # type-check (tsc) + production build to dist/
npm run preview      # serve the production build
npm run typecheck    # tsc --noEmit only
```

## Connecting the live API

1. Copy the env template and add your key:
   ```bash
   cp .env.example .env
   # then set VITE_TRAFFIC_API_KEY=...  (URL already defaults correctly)
   ```
2. Start the app, flip the header toggle to **Live API**, and click **Fetch
   Traffic Data**. The key can also be pasted at runtime in *API Configuration*.
3. Watch the **API Response / Debug** panel — it shows the exact request URL,
   HTTP status, response time, counts, and the raw JSON.

**Security:** any key shipped to a browser is ultimately visible to the client.
`.env` is gitignored, which is fine for local dev, but for anything shared put a
thin proxy in front of the endpoint and keep the key server-side.

**CORS:** if the browser blocks live calls, the Gateway needs to allow this
origin, or you add a dev proxy in `vite.config.ts` (`server.proxy`).

## How the pieces map to the API

```
location  ──▶  segments (GeoJSON LineStrings)  ──▶  map + segment table + info panel
          └─▶  timeline (per-timestamp speeds)  ──▶  stats + charts + traffic coloring
                                                 └─▶  vehicle simulation (speed-driven)
```

- **Empty timeline is handled explicitly.** Some timestamps legitimately return
  `"timeline": []`. The app does *not* treat that as an error — it shows
  “No traffic observations available…”, reports `Segments: N / Observations: 0`,
  and still draws the road segments.
- **Traffic coloring** uses `relative_speed`: ≥90% free, 70–89% moderate,
  50–69% slow, <50% heavy. The API's aggregate applies network-wide per
  timestamp, so the whole network shares one traffic color at a given time;
  routes are distinguished by the coloured casing underneath.

## Where forecasting plugs in

The **ML Forecast** card is a deliberate placeholder (no fake numbers). It's the
seam where the LightGBM model (`aiko-traffic-forecasting@production`) would
provide the +15 min prediction against the current observed speed.

## Structure

```
src/
  components/       Header, TrafficMap, TrafficSimulation, TimelineControls,
                    TrafficStats, SpeedChart, RelativeSpeedChart, SegmentTable,
                    SegmentInfo, ApiConfig, ApiQueryPanel, ApiDebugPanel,
                    ApiResponseExplorer, MlForecast, TrafficLegend
    ui/             small shadcn-style primitives (card, button, badge, …)
  services/         trafficApi.ts   ← the single mock/live swap point
  types/            traffic.ts      ← API response interfaces (source of truth)
  data/             mockTrafficData.ts
  utils/            geo.ts, traffic.ts, simulation.ts
```

## Notes / decisions

- **shadcn/ui:** the UI primitives under `components/ui` are hand-rolled in the
  shadcn style so the project runs with zero CLI setup. To adopt the real
  library, run `npx shadcn@latest init` and `add` the components — the import
  sites already match its conventions.
- **Map tiles:** MapLibre GL with free CARTO dark raster tiles (no key needed).
  Swap `MAP_STYLE` in `TrafficMap.tsx` for a vector style (MapTiler/OpenFreeMap)
  if you prefer.
- **Mock data** mirrors the real free-flow sample (location, 10 segments across
  the two Tampere–Helsinki carriageways, the 7 observed timeline points).
  Coordinates are synthesized to sit plausibly near the sample point; the speed
  figures are the exact observed values.
```

Tech: React 18 · TypeScript · Vite 5 · Tailwind 3 · MapLibre GL · Recharts.
