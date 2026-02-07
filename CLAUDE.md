# Valhalla - Project Guidelines

## Tech Stack

- **Backend**: Go (goroutines for 6-layer stack, minimal dependencies)
- **Frontend**: React 18+ with TypeScript, built with Vite
- **State Management**: Zustand
- **Visualization**: D3.js or React Flow, Framer Motion
- **Communication**: REST + WebSocket (Go stdlib + nhooyr.io/websocket)
- **Deployment**: Single binary via go:embed

## Installed Skills

### Go Backend
- **Go Pro**: `.agents/skills/golang-pro/` — Go idioms, concurrency patterns, goroutines, channels, context usage, gRPC
- **Go Testing**: `.agents/skills/golang-testing/` — Table-driven tests, subtests, benchmarks, fuzzing, TDD
- **Sharp Edges** (Trail of Bits): `.agents/skills/sharp-edges/` — Security footguns, misuse-resistant APIs, secure defaults, crypto ergonomics

### React/TypeScript Frontend
- **React Best Practices**: `.agents/skills/vercel-react-best-practices/AGENTS.md` — 40+ optimization rules for React/Next.js
- **Composition Patterns**: `.agents/skills/vercel-composition-patterns/AGENTS.md` — React component architecture patterns
- **Web Design Guidelines**: `.agents/skills/web-design-guidelines/SKILL.md` — UI accessibility, performance, and UX audit rules
- **Zustand State Management**: `.agents/skills/zustand-state-management/` — Type-safe stores, persist middleware, slices pattern, hydration handling
- **D3.js Visualization**: `.agents/skills/d3-viz/` — Network diagrams, SVG-based data visualization, transitions, interactions
- **Framer Motion**: `.agents/skills/framer-motion-best-practices/` — Animation performance, gestures, layout transitions, scroll-linked effects

## Installed Plugins

### Development Workflow
- **commit-commands** — Git commit, push, and PR creation (`/commit`, `/commit-push-pr`)
- **code-review** — Pull request code review (`/code-review`)
- **pr-review-toolkit** — Comprehensive PR review with specialized agents (`/review-pr`)
- **feature-dev** — Guided feature development with codebase understanding (`/feature-dev`)
- **frontend-design** — Production-grade UI component generation (`/frontend-design`)
- **code-simplifier** — Auto-simplifies code for clarity and maintainability
- **ralph-loop** — Autonomous task loop (`/ralph-loop`)
- **hookify** — Create hooks to prevent unwanted behaviors (`/hookify`)

### Language Servers
- **gopls-lsp** — Go language server (diagnostics, autocomplete, error checking)
- **typescript-lsp** — TypeScript language server (diagnostics, type checking)
- **pyright-lsp** — Python language server

### Integrations
- **github** — GitHub operations (PRs, issues, checks)
- **context7** — Live library documentation lookup
- **playwright** — Browser automation and testing
- **security-guidance** — Security best practices (automatic)
