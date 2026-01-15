# Mission System

## Overview

The mission system combines **story-driven tutorial missions** (JSON-defined) with **procedural mission generation** for ongoing gameplay. After completing the tutorial, players receive dynamically generated missions organized into story arcs.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Mission System                          │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────────┐    ┌──────────────────────────────┐   │
│  │ Story Missions  │    │    Procedural Missions       │   │
│  │ (JSON-defined)  │    │                              │   │
│  │                 │    │  ┌────────────────────────┐  │   │
│  │ • Tutorial P1   │    │  │  MissionGenerator.js   │  │   │
│  │ • Tutorial P2   │    │  │  - Network generation  │  │   │
│  │ • Welcome msgs  │    │  │  - Mission types       │  │   │
│  │                 │    │  │  - Arc generation      │  │   │
│  └────────┬────────┘    │  └────────────┬───────────┘  │   │
│           │             │               │              │   │
│           v             │               v              │   │
│  ┌─────────────────┐    │  ┌────────────────────────┐  │   │
│  │StoryMissionMgr  │    │  │  MissionPoolManager    │  │   │
│  │                 │    │  │  - Pool maintenance    │  │   │
│  │ • Event triggers│    │  │  - Arc progression     │  │   │
│  │ • Scripted evts │    │  │  - Failure handling    │  │   │
│  └────────┬────────┘    │  └────────────┬───────────┘  │   │
│           │             │               │              │   │
│           └─────────────┼───────────────┘              │   │
│                         │                              │   │
│                         v                              │   │
│              ┌────────────────────────┐                │   │
│              │     GameContext        │                │   │
│              │ • activeMission        │                │   │
│              │ • availableMissions    │                │   │
│              │ • deadlineTime         │                │   │
│              └────────────────────────┘                │   │
└─────────────────────────────────────────────────────────────┘
```

## Key Components

### MissionGenerator.js
Generates procedural missions with complete infrastructure:
- **Network generation**: Creates network IDs, file systems, and files
- **Mission types**: repair, backup, transfer
- **Time limits**: 3-10 minutes based on objective count
- **Arc generation**: 2-3 connected missions per storyline
- **NAR attachments**: Network credentials in mission briefings

### MissionPoolManager.js
Manages the available mission pool:
- Maintains 3-5 missions available at any time
- Handles arc progression (unlocking next mission on success)
- Handles arc failure (removes all pending arc missions)
- Generates mix of single missions and arcs
- Tracks completed missions to avoid repetition

### arcStorylines.js
Contains 10 storyline templates for mission arcs:
1. Supply Chain Breach
2. Data Recovery Escalation
3. Merger Integration
4. Compliance Audit
5. Ransomware Aftermath
6. Infrastructure Migration
7. Whistleblower Protection
8. Disaster Recovery
9. Vendor Transition
10. Security Incident Response

### StoryMissionManager.js
Orchestrates story/tutorial missions:
- Loads mission JSON definitions
- Subscribes to trigger events
- Executes scripted events (sabotage, disconnections)

### ObjectiveTracker.js
Monitors game state for objective completion:
- Supports: networkConnection, networkScan, fileSystemConnection, fileOperation, narEntryAdded, verification
- Emits objectiveComplete events
- Tracks file operation progress

## Objective Types

### networkConnection
Player must connect to specified network via VPN.
```json
{
  "type": "networkConnection",
  "target": "clienta-corporate"
}
```

### fileSystemConnection
Player must connect File Manager to file system.
```json
{
  "type": "fileSystemConnection", 
  "target": "192.168.50.10"
}
```

### fileOperation
Player must perform file operations on files.
```json
{
  "type": "fileOperation",
  "operation": "copy" | "repair" | "delete",
  "count": 8,
  "sourcePrefix": "client_data",
  "destination": "local"
}
```

### narEntryAdded
Player must add network credentials to NAR.
```json
{
  "type": "narEntryAdded",
  "networkId": "network-id"
}
```

### verification
Auto-completes when all other objectives are done.
```json
{
  "type": "verification",
  "description": "Verify all tasks completed"
}
```

## Procedural Mission Generation

### Mission Types

**Repair Mission**
- Connect to client network
- Connect to damaged file system
- Repair corrupted files
- Time limit: 3-6 minutes

**Backup Mission**  
- Connect to client network
- Connect to source file system
- Copy files to backup server
- Time limit: 4-7 minutes

**Transfer Mission**
- Connect to source network
- Copy files from source
- Connect to destination network
- Paste files to destination
- Time limit: 5-10 minutes

### Arc Generation
Arcs are 2-3 mission sequences with a shared storyline:
- First mission is available immediately
- Subsequent missions unlock on completion
- Failing any mission removes all pending arc missions
- Payouts increase for later arc missions (1.5x-2x)

### Time Limits
- Base: 3 minutes
- Per objective: +1-2 minutes
- Range: 3-10 minutes total
- ~50% of missions have time limits

### Payout Calculation
```
basePayout = baseAmount × difficultyMultiplier × arcPositionBonus
finalPayout = basePayout × reputationMultiplier
```

Difficulty multipliers:
- Easy: 1.0x
- Medium: 1.3x  
- Hard: 1.6x

Arc position bonuses:
- Part 1: 1.0x
- Part 2: 1.5x
- Part 3: 2.0x

## Deadline System

When a timed mission is accepted:
1. `deadlineTime` calculated from `currentTime + timeLimitMinutes`
2. Countdown displayed in TopBar and MissionBoard
3. GameContext polls deadline vs current time
4. On expiry, mission automatically fails

Visual indicators:
- Normal: Blue countdown display
- Urgent (<1 min): Red pulsing countdown
- Expired: Mission failed notification

## Client Types & Reputation

Reputation tiers affect which clients are available:
- **Tier 1-3:** library, museum, small-business
- **Tier 4-6:** medium-business, retail, nonprofit
- **Tier 7-9:** corporation, bank, government
- **Tier 10-11:** All + special/elite contracts

## File Structure

```
missions/
├── MissionGenerator.js      # Procedural generation
├── MissionPoolManager.js    # Pool management & arcs
├── arcStorylines.js         # Arc storyline templates
├── StoryMissionManager.js   # Story mission orchestration
├── ObjectiveTracker.js      # Objective completion tracking
├── ScriptedEventExecutor.js # Scripted event handling
├── missionData.js           # Story mission imports
├── messageTemplates.js      # Mail message templates
└── data/
    ├── welcome-messages.json
    ├── mission-board-intro.json
    ├── tutorial-part-1.json
    └── tutorial-part-2.json
```

## Testing

- Unit tests: `*.test.js` files
- E2E tests: `e2e/playthroughs/procedural-missions.e2e.js`

## Flow Example

1. Player completes tutorial missions
2. MissionPoolManager initializes with 3-5 procedural missions
3. Player accepts mission with 5-minute deadline
4. Countdown starts in TopBar
5. Player completes objectives before deadline
6. If arc mission, next mission in arc becomes available
7. Pool replenishes to maintain 3-5 available missions
