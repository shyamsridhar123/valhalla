# Valhalla UI

The web-based visualization frontend for the Valhalla networking stack. Connects to the Go daemon via WebSocket and renders live network state, stack activity, and demo scenarios.

## Tech Stack

| Library | Version | Purpose |
|---------|---------|---------|
| React | 19 | Component framework |
| TypeScript | 5.9 | Type safety |
| Vite | 7 | Dev server + bundler |
| D3.js | 7 | Force-directed network topology graph |
| Zustand | 5 | Lightweight state management |
| Framer Motion | 12 | Animation (packet flow, transitions) |

## Structure

```
src/
├── App.tsx                    Main layout and routing
├── main.tsx                   Entry point
├── theme.ts                   Color palette and design tokens
├── components/
│   ├── NetworkGraph.tsx       D3 force-directed mesh topology
│   ├── StackView.tsx          6-layer stack visualization
│   ├── TrustGraph.tsx         Attestation / trust network
│   ├── DemoRunner.tsx         Scenario selection and playback
│   ├── ScenarioCard.tsx       Individual scenario display card
│   ├── ScenarioViz.tsx        Scenario-specific visualizations
│   ├── NarrationTimeline.tsx  Guided narration during demos
│   ├── LayerActivityBar.tsx   Per-layer event activity indicator
│   ├── EventLog.tsx           Real-time event stream viewer
│   └── scenarioMeta.ts        Scenario metadata and descriptions
├── hooks/
│   └── useValhalla.ts         WebSocket connection to Go daemon
├── store/
│   └── useValhallaStore.ts    Zustand store for network state
├── types/
│   └── api.ts                 TypeScript types matching Go API
└── utils/
    └── d3-helpers.ts          D3 utilities for graph rendering
```

## Development

```bash
npm install       # Install dependencies
npm run dev       # Start Vite dev server (HMR on :5173)
npm run build     # Production build → dist/
npm run lint      # Run ESLint
```

During development, the UI proxies API requests to the Go backend at `localhost:8080`. Run `make dev` from the project root to start both the Go daemon and the Vite dev server simultaneously.

## Production Build

The production build output (`dist/`) is copied into `cmd/valhalla/ui-dist/` and embedded into the Go binary via `go:embed`. The single binary serves the UI at the root path.

```bash
# From project root:
make build        # Builds UI, embeds in Go binary → ./bin/valhalla
```
