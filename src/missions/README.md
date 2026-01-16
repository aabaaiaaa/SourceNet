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
│              │ • missionPool          │                │   │
│              │ • pendingArcMissions   │                │   │
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
- **NAR revocation**: Credentials auto-revoke on mission completion

### MissionPoolManager.js
Manages the available mission pool:
- Maintains 4-6 missions available at any time (configurable)
- Ensures minimum 2 accessible missions at player's reputation
- Handles arc progression (unlocking next mission on success)
- Handles arc failure (removes all pending arc missions)
- 20% chance to generate an arc instead of single mission
- Tracks active clients to avoid duplicate missions

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
- Tracks file operation progress with cumulative completion

## Objective Types

### networkConnection
Player must connect to specified network via VPN.
```json
{
  "type": "networkConnection",
  "target": "clienta-corporate"
}
```

### networkScan
Player must scan network and discover a specific machine/server.
```json
{
  "type": "networkScan",
  "target": "network-id",
  "expectedResult": "server-hostname"
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
  "operation": "copy" | "paste" | "repair" | "delete",
  "targetFiles": ["file1.txt", "file2.txt"],
  "count": 8,
  "destination": "192.168.50.20"
}
```

### narEntryAdded
Player must add network credentials to NAR.
```json
{
  "type": "narEntryAdded",
  "target": "network-id"
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
- Scan network to find damaged server
- Connect to file system
- Repair corrupted files
- Time limit: 3-6 minutes

**Backup Mission**  
- Connect to source network
- Scan to find source server
- Copy files from source
- Either paste to backup server on same network (40% chance)
- Or connect to separate backup network and paste there (60% chance)
- Time limit: 4-8 minutes

**Transfer Mission**
- Connect to source network
- Scan and copy files from source
- Connect to destination network
- Scan and paste files to destination
- Time limit: 5-10 minutes

### Arc Generation
Arcs are 2-3 mission sequences with a shared storyline:
- First mission is available immediately in `missionPool`
- Subsequent missions stored in `pendingArcMissions`
- On success: next mission unlocked and added to pool
- On failure: all pending arc missions removed
- Payouts increase for later arc missions (1.5x-2x)
- Arc missions include `[Mission X of Y]` indicator in briefing

### NAR Credential Handling
- Each mission provides network credentials as NAR attachments
- Credentials sent in mission briefing email when mission accepted
- `revokeOnComplete: true` - credentials auto-revoke when mission ends
- Player disconnected from mission networks on completion

### Time Limits
- Base: 3 minutes
- Per objective: +0.8 minutes (approx)
- Range: 3-10 minutes total
- ~50% of missions have time limits

### Payout Calculation
```
basePayout = basePerObjective × objectiveCount × tierMultiplier
timeBonus = 300 × (10 / timeLimitMinutes)  // If timed
finalPayout = basePayout + timeBonus
```

Base per objective: 200 credits

Tier multipliers (by client type):
- Banks: 1.0x (local) → 1.8x (national)
- Government: 0.8x (library) → 2.0x (federal)
- Healthcare: 1.0x (clinic) → 1.7x (research)
- Corporate: 1.0x (small) → 1.8x (enterprise)
- Nonprofit: 0.7x (local) → 1.0x (national)

Arc position bonuses:
- Part 1: 1.0x
- Part 2: 1.5x
- Part 3: 2.0x

## Pool Configuration

```javascript
const poolConfig = {
    min: 4,           // Minimum missions in pool
    max: 6,           // Maximum missions in pool
    minAccessible: 2, // Minimum accessible at current reputation
    arcChance: 0.2,   // 20% chance to generate arc vs single mission
};
```

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

## Arc Progression Flow

```
┌──────────────────┐
│ Arc Generated    │
│ (3 missions)     │
└────────┬─────────┘
         │
         v
┌──────────────────┐     ┌──────────────────┐
│ Mission 1/3      │────>│ pendingArcMissions│
│ in missionPool   │     │ [Mission 2, 3]   │
└────────┬─────────┘     └──────────────────┘
         │
    Player accepts
         │
         v
┌──────────────────┐
│ Mission 1/3      │
│ active           │
└────────┬─────────┘
         │
    ┌────┴────┐
    │         │
 Success    Failure
    │         │
    v         v
┌─────────┐  ┌─────────────────┐
│ 2/3     │  │ Arc cancelled   │
│ unlocked│  │ Pending removed │
│ to pool │  └─────────────────┘
└────┬────┘
     │
  (repeat)
     │
     v
┌─────────────────┐
│ Arc complete!   │
│ All 3 succeeded │
└─────────────────┘
```

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
2. "Better" message read triggers pool initialization
3. MissionPoolManager initializes with 4-6 procedural missions
4. Player accepts mission with 5-minute deadline
5. Briefing email with NAR credentials sent to inbox
6. Countdown starts in TopBar
7. Player adds credentials to NAR, connects, completes objectives
8. If arc mission, next mission in arc becomes available
9. NAR credentials revoked, player disconnected from mission networks
10. Pool replenishes to maintain 4-6 available missions
