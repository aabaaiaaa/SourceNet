# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## ⚠️ Pre-1.0 Development

This project is in active pre-1.0 development (version 0.1.0-alpha). **Do NOT add:**
- Backward compatibility code
- Legacy support for old save formats
- Migration code for deprecated features
- Version checking for old data structures

Breaking changes are expected and acceptable. Remove legacy code rather than maintain it.

## Commands

- `npm run dev` - Start dev server (http://localhost:5173)
- `npm run build` - Production build
- `npm test` - Run all unit tests
- `npm test <filter>` - Run unit tests matching filter (e.g. `npm test BankingSystem`)
- `npm run test:e2e` - Run E2E system tests
- `npm run test:e2e:playthroughs` - Run E2E playthrough tests
- `npx playwright test e2e/systems/boot.e2e.js` - Run single E2E test file
- `npm run lint` - Run ESLint
- `npm run generate:scenarios` - Regenerate debug scenario fixtures (`e2e/generators/`)

## Architecture

**State Management:**
- `src/contexts/GameContext.jsx` - Central game state provider (1800+ lines)
- `src/contexts/useGame.js` - Hook to access game state (always import from here, not GameContext)
- `src/core/triggerEventBus.js` - Pub/sub event bus for decoupled communication (methods: `on`, `off`, `emit`, `once`, `clear`)

**System Design Pattern:**
- `src/systems/` contains pure JavaScript modules (no state) — they export functions for calculations and validation
- All mutable state lives in GameContext; systems provide logic that GameContext calls to update state
- Decoupled communication via `triggerEventBus` events (`desktopLoaded`, `networkConnected`, `messageRead`, `softwareInstalled`, etc.)
- `src/systems/NetworkRegistry.js` is a global singleton — single source of truth for all network/device/file system data

**Key Folders:**
- `src/components/apps/` - In-game applications (BankingApp, SNetMail, FileManager, etc.)
- `src/components/ui/TopBar.jsx` - App launcher; apps registered via `appMap` object mapping software IDs to display info
- `src/missions/data/` - JSON mission definitions
- `src/systems/` - Game systems (BankingSystem, ReputationSystem, NetworkRegistry, etc.)
- `src/core/` - Event bus, game time scheduler, system message templates
- `src/debug/` - Debug panel and scenario loading

## File System & Clipboard

**File Persistence:**
- File operations (paste, delete, repair) are persisted to `narEntries` via `updateFileSystemFiles(networkId, fileSystemId, files)`
- Files persist across file system switches and network reconnects
- When missions merge file systems into NAR, user files are preserved but mission files overwrite duplicates

**Clipboard Behavior:**
- File clipboard auto-clears when disconnecting from the source network
- FileManager auto-clears its state when the selected file system's network is disconnected

## Game Time System

Components that need delays or timers must respect game time speed:
- Use `scheduleGameTimeCallback(callback, delayMs, timeSpeed)` from `src/core/gameTimeScheduler.js`
- Access `timeSpeed` from `useGame()` - values defined in `src/constants/gameConstants.js`:
  - `TIME_SPEEDS.NORMAL` = 1 (normal speed)
  - `TIME_SPEEDS.FAST` = 10 (in-game fast forward)
  - `TIME_SPEEDS.TEST` = 100 (automated testing only)
- Game can be paused (`isPaused` from context)
- **Never use raw `setTimeout` for in-game delays** - they won't scale with time speed

**Setting time speed:**
- In-game UI uses `toggleTimeSpeed()` - toggles between 1x and 10x only
- For tests, use `setSpecificTimeSpeed(speed)` to set any value including 100x:
  - Unit tests: `const { setSpecificTimeSpeed } = useGame(); setSpecificTimeSpeed(100);`
  - E2E tests: `await page.evaluate(() => window.gameContext.setSpecificTimeSpeed(100));`

## Mission System

**Structure:**
- `src/missions/data/*.json` - Mission definitions (objectives, triggers, rewards)
- `src/missions/StoryMissionManager.js` - Singleton that orchestrates story missions
- `src/missions/ObjectiveTracker.js` - Monitors game state for objective completion
- `src/missions/ScriptedEventExecutor.js` - Executes scripted events (delays, messages, etc.)
- `src/missions/useStoryMissions.js` - React hook that connects missions to game context
- `src/missions/MissionPoolManager.js` - Procedural mission generation (progression: early → midGame → lateGame)

**Objective Types:**
- `networkConnection` - Connect to a network (`target`: networkId)
- `networkScan` - Scan network and find target (`target`: networkId, `expectedResult`: hostname/ip)
- `fileSystemConnection` - Connect FileManager to file system (`target`: ip or fileSystemId)
- `narEntryAdded` - Network added to NAR (`target`: networkId)
- `fileOperation` - File operation with specific files (`operation`: paste/copy/repair/delete, `targetFiles`: array of filenames)
- `fileDecryption` - Decrypt specific encrypted files (`targetFiles`: array of encrypted filenames)
- `fileUpload` - Upload files to a destination (`targetFiles`: array of filenames, `destination`: ip)
- `avThreatDetected` - AV detects malware files (`targetFiles`: array of filenames)
- `verification` - Auto-added final objective with 3-second delay before mission completes (do not add manually)

**File Operations:** Use `targetFiles` array to require specific files. Progress tracks unique files - pasting the same file multiple times won't count toward completion.

**Pre-completion:** Objectives can be completed before they become "current" (tracked with `preCompleted` flag). The system handles this automatically.

**Story Events:**
- Missions can trigger scripted events via `scriptedEvents` array in mission JSON
- Events fire on triggers like `missionAccepted`, `objectiveCompleted`, `missionCompleted`
- Event types: `sendMessage`, `delay`, `unlockSoftware`, etc.

**Triggers:**
- Events emitted via `triggerEventBus`: `desktopLoaded`, `networkConnected`, `messageRead`, `softwareInstalled`, etc.
- Story missions listen for triggers to activate

## Save/Load System

**Save Data** (stored in localStorage):
- Multiple save slots supported
- Key state saved: `gamePhase`, `username`, `currentTime`, `bankAccounts`, `messages`, `windows`, `activeMission`, `completedMissions`, `reputation`, `software`, `narEntries`, etc.
- Time speed always resets to 1x on load

**Important:**
- New state added to GameContext must be added to both `getSaveData()` and `loadGame()` functions
- Windows are persisted with position, z-index, and minimized state

## Debug System

**URL Parameters:**
- `?debug=true` - Enable debug mode
- `?skipBoot=true` - Skip boot sequence
- `?scenario=<name>` - Load a scenario directly (skips boot, goes to desktop with scenario state)
- Example: `http://localhost:5173/?scenario=fresh-start&debug=true`

**Debug Panel:** Ctrl+Shift+D (only available with `?debug=true`)
- Tabs: Scenarios, State Controls, Event Log
- Load scenarios to jump to specific game states instantly

**Scenarios:**
- Pre-built game states for testing specific situations
- Defined in `src/debug/scenarios.js`
- JSON fixtures generated by E2E tests in `e2e/generators/`
- Run `npm run generate:scenarios` to regenerate fixtures

## Conventions
- Prefix unused parameters with `_` (ESLint enforces `no-unused-vars` but ignores `_`-prefixed and all-caps names)
- Test files: `Component.test.jsx` co-located with source
- Only `fileManager` allows multiple window instances (see `MULTI_INSTANCE_APPS` in gameConstants.js)
- `completedMissions` is an array of objects with `.missionId` property — use `.some(m => m.missionId === id)` not `.includes(id)`
- `software` state is an array of **string IDs** (e.g. `['portal', 'mail', 'decryption-tool']`), NOT objects — use `software.includes(id)` not `software.map(s => s.id)`

## Testing

**E2E Helpers** (`e2e/helpers/common-actions.js`):
- `completeBootAndLogin(page)` - Full boot sequence
- `openApp(page, appName)` - Open app from launcher
- `closeWindow(page, windowTitle)` - Close window by title
- `setSpecificTimeSpeed(page, speed)` - Set game time speed (use 100 for fast tests)
- `connectToNetwork(page, networkName)` - Connect via VPN Client
- `scanNetwork(page, networkName, expectedHost)` - Scan network
- `connectFileManager(page, fileSystemId)` - Connect to file system
- `waitForMessage(page, subject, timeout)` - Wait for mail arrival
- `readMessage(page, subject)` - Open and read message
- `depositCheque(page)` - Deposit cheque attachment
- `waitForObjectiveComplete(page, objectiveText, timeout)` - Wait for objective completion
- `saveGame(page)` / `loadGameFromPowerMenu(page, username)` - Save/load operations
- `dismissForcedDisconnectionOverlay(page, timeout)` - Dismiss overlay if visible

**Unit Tests:**
- `triggerEventBus.clear()` is called automatically between tests (see `src/test/setup.js`)
- Wrap components in `GameProvider` for testing
- Console log/warn/error mocked to reduce noise in test output

**Playwright Config:**
- Auto-starts dev server on localhost:5173
- Test timeout: 60s, action timeout: 10s
- Two projects: `chromium` (parallel) and `generators` (sequential, workers=1)

## Gotchas
- Game time starts at March 25, 2020 09:00:00
- Time speed resets to 1x on save/load
- Event bus persists between tests - setup.js handles clearing
- Story missions have `"oneTime": true` - check `completedMissions` to prevent re-triggering
- At 100x test speed, mission verification and clearing happen very fast — `activeMission` may become null before you can observe objective completion
- `generateFiles()` in MissionGenerator.js has file templates per industry per mission type — new mission types need templates added or they fall back to `corporate.repair`
- Window z-index starts at 1000 and increments via `nextZIndexRef`; cascade positioning offsets each new window by 30px
