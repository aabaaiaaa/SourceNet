# Story Mission System

## Overview

The Story Mission System is a data-driven architecture for creating missions, story events, and scripted gameplay sequences without modifying core game code.

## Key Components

### StoryMissionManager.js
Orchestrates mission lifecycle:
- Loads mission JSON definitions
- Subscribes to trigger events
- Activates missions when triggers fire
- Executes scripted events

### ObjectiveTracker.js
Monitors game state for objective completion:
- Supports: networkConnection, networkScan, fileSystemConnection, fileOperation
- Emits objectiveComplete events
- Tracks progress automatically

### ScriptedEventExecutor.js
Executes story-driven events:
- Tutorial sabotage (file deletion)
- Forced disconnections
- Mission status changes
- Blocks player control during scripted sequences

### missionData.js
Central import point for all mission JSONs:
- Imports all mission definitions
- Provides `initializeAllMissions()` for registration
- Categorizes missions (tutorial, post-tutorial)

## Creating New Missions

### Mission JSON Structure

```json
{
  "missionId": "unique-mission-id",
  "title": "Mission Title",
  "client": "Client Name",
  "clientType": "library" | "museum" | "small-business" | "retail" | etc.,
  "difficulty": "Easy" | "Medium" | "Hard",
  "basePayout": 1000,
  "category": "story-tutorial" | "post-tutorial",

  "requirements": {
    "software": ["vpn-client", "network-scanner"],
    "minReputation": 3
  },

  "objectives": [
    {
      "id": "obj-1",
      "description": "Objective description shown to player",
      "type": "networkConnection" | "networkScan" | "fileSystemConnection" | "fileOperation",
      "target": "target-identifier",
      "operation": "copy" | "repair" | "delete",  // For fileOperation type
      "count": 8  // Number of files (for fileOperation)
    }
  ],

  "scriptedEvents": [
    {
      "id": "event-id",
      "trigger": {
        "type": "afterObjectiveComplete",
        "objectiveId": "obj-4",
        "delay": 5000
      },
      "actions": [
        {
          "type": "forceFileOperation" | "forceDisconnect" | "setMissionStatus",
          // ... action-specific properties
        }
      ]
    }
  ],

  "consequences": {
    "success": {
      "credits": "calculated",  // Or fixed number
      "reputation": 1,
      "messages": []
    },
    "failure": {
      "credits": -500,
      "reputation": -1,
      "messages": []
    }
  }
}
```

## Objective Types

### networkConnection
Player must connect to specified network via VPN.

```json
{
  "type": "networkConnection",
  "target": "clienta-corporate"  // Network ID
}
```

### networkScan
Player must scan network and find expected result.

```json
{
  "type": "networkScan",
  "target": "network-id",
  "expectedResult": "fileserver-01"  // Hostname or IP
}
```

### fileSystemConnection
Player must connect File Manager to file system.

```json
{
  "type": "fileSystemConnection",
  "target": "192.168.50.10"  // IP or file system ID
}
```

### fileOperation
Player must perform file operation.

```json
{
  "type": "fileOperation",
  "operation": "copy" | "repair" | "delete",
  "count": 8  // Number of files
}
```

## Adding New Missions

1. **Create JSON file** in `data/post-tutorial/`
2. **Import in missionData.js:**
   ```javascript
   import newMission from './data/post-tutorial/new-mission.json';
   ```
3. **Add to postTutorialMissions array:**
   ```javascript
   export const postTutorialMissions = [
     // ... existing missions
     newMission,
   ];
   ```
4. **Test:** Mission will be loaded on game start

## Client Types & Reputation

Reputation tiers affect which clients are available:
- **Tier 1-3:** library, museum, small-business
- **Tier 4-6:** medium-business, retail
- **Tier 7-9:** corporation, bank, government
- **Tier 10-11:** All + special/elite contracts

## Mission Difficulty & Cooldowns

- **Easy:** No cooldown (can chain immediately)
- **Medium:** 10-15 minute cooldown
- **Hard:** 30-45 minute cooldown

## Payout Calculation

Base payout × reputation multiplier:
- Tier 1: 0.5x
- Tier 3: 0.85x
- Tier 5: 1.0x
- Tier 9: 1.5x
- Tier 11: 2.0x

## Testing

Unit tests for mission logic in respective `.test.js` files.
Integration tests in `src/test/integration/`.
E2E tests for complete mission flows in `e2e/`.

## Current Missions

**Tutorial:**
- tutorial-part-1.json (Sabotage mission)
- tutorial-part-2.json (Recovery mission)

**Post-Tutorial (7 missions):**
- file-backup-01.json
- file-backup-02.json
- file-repair-01.json
- file-repair-02.json
- file-restoration-01.json
- file-restoration-02.json
- combined-tasks-01.json

## Future Enhancements

- Procedural mission generation
- Branching story paths
- Time-sensitive missions
- Mission rewards beyond credits/reputation
- Community-created missions (mod support)
