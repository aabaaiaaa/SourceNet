# SourceNet

A browser-based hacking simulation game built with React and Vite.

## Quick Start

```bash
npm install
npm run dev          # http://localhost:5173
```

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Production build |
| `npm test` | Run unit tests (613 tests) |
| `npm run test:e2e` | Run E2E tests (103 tests) |
| `npm run lint` | Run ESLint |

## Project Structure

```
src/
├── components/       # React components
│   ├── apps/         # In-game applications (Mail, Banking, Portal, etc.)
│   ├── boot/         # Boot sequence UI
│   └── ui/           # Desktop, windows, overlays
├── contexts/         # React context (GameContext, useGame)
├── systems/          # Game systems (banking, reputation, storage, etc.)
├── missions/         # Mission system and story events
├── constants/        # Game constants
├── core/             # Core utilities (event bus, scheduler)
└── debug/            # Debug panel and scenarios

e2e/                  # Playwright E2E tests
docs/                 # Design documentation
```

## Tech Stack

- **React 19** - UI framework
- **Vite** - Build tool
- **Vitest** - Unit testing
- **Playwright** - E2E testing
- **ESLint** - Linting

## Game Features

- Window management system with drag, minimize, restore
- Time system with adjustable speed (1x/10x) and pause
- Save/load system with multiple slots
- Mission system with objectives and story events
- Banking, reputation, and software installation systems
- Boot sequence simulation
