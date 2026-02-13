# Mission System Architecture

This document maps out every subsystem involved in SourceNet's mission lifecycle -- from trigger detection through objective tracking to narrative delivery and consequences.

---

## System Overview

```
                         +---------------------------+
                         |   Mission JSON Definitions |
                         |   src/missions/data/*.json |
                         +-------------+-------------+
                                       |
                                       | registered into
                                       v
+-------------------+         +--------+-----------+         +----------------------+
| triggerEventBus   | events  | StoryMissionManager | events | useStoryMissions.js  |
| (pub/sub core)    +-------->| (singleton          +------->| (React hook -        |
|                   |         |  orchestrator)      |        |  bridges to context) |
+--------+----------+         +----+-------+--------+        +----------+-----------+
         ^                         |       |                            |
         |                         |       |                            v
  emitted from:                    |       |                  +---------+----------+
  - VPNClient                      |       |                  | GameContext.jsx     |
  - FileManager                    |       |                  | (central state)    |
  - NetworkScanner                 |       |                  +----+----------+----+
  - DataRecoveryTool               |       |                       |          |
  - LogViewer                      |       |                       v          v
  - SNetMail                       |       |               MissionBoard   SNetMail
  - GameContext                    |       |               (UI display)  (messages)
                                   v       v
                         +---------+--+ +--+-----------------+
                         | Objective  | | ScriptedEvent      |
                         | Tracker    | | Executor           |
                         | (evaluates | | (sabotage, forced  |
                         |  progress) | |  disconnect, etc.) |
                         +------------+ +--------------------+
```

---

## File Locations

| File | Responsibility |
|------|---------------|
| `src/missions/data/*.json` | Mission definitions (objectives, networks, narrative, rewards) |
| `src/missions/StoryMissionManager.js` | Singleton orchestrator -- registers missions, subscribes to triggers, schedules events |
| `src/missions/useStoryMissions.js` | React hook -- bridges StoryMissionManager to GameContext, delivers messages |
| `src/missions/ObjectiveTracker.js` | Pure utility -- evaluates whether objectives are complete given game state |
| `src/missions/useObjectiveAutoTracking.js` | React hook -- listens to game events and auto-completes objectives |
| `src/missions/ScriptedEventExecutor.js` | Executes dramatic actions (file deletion, forced disconnect, mission failure) |
| `src/missions/messageTemplates.js` | Centralized message templates with placeholder support |
| `src/missions/missionData.js` | Imports and exports all mission JSON files |
| `src/core/triggerEventBus.js` | Pub/sub event bus for decoupled communication |
| `src/contexts/GameContext.jsx` | Central game state -- holds activeMission, completedMissions, all mission methods |
| `src/components/apps/MissionBoard.jsx` | UI -- displays available/active/completed/failed missions |
| `src/systems/MissionSystem.js` | Payout calculation with reputation multipliers |
| `src/systems/DecryptionSystem.js` | Core decryption/encryption logic and algorithm support |
| `src/systems/useAntivirusScanner.js` | Active AV scanning hook -- monitors local SSD for malware files |
| `src/core/systemMessages.js` | System message templates (CPU unlock, algorithm info, story teaser) |
| `src/components/apps/DecryptionTool.jsx` | Decryption Tool UI -- file decryption and upload workflow |
| `src/components/ui/RansomwareOverlay.jsx` | Ransomware attack encryption animation overlay |
| `src/components/boot/RansomwareLockScreen.jsx` | Ransomware lock screen shown at boot (manual unlock) |
| `src/components/ui/SecurityIndicator.jsx` | Top-bar security status indicator (firewall/antivirus) |

---

## Mission Lifecycle

### Phase 1: Registration (App Start)

```
useStoryMissions mounts
  -> loads all mission JSON from missionData.js
  -> calls storyMissionManager.initializeAllMissions()
     -> for each mission:
        - if has triggers.start  -> subscribeMissionTrigger()
        - if has events[]        -> subscribeStoryEventTrigger() per event
        - if has scriptedEvents  -> subscribeScriptedEventTriggers()
     -> subscribeMissionConsequences() for missionComplete events
```

### Phase 2: Trigger Detection

A game event fires (e.g., `softwareInstalled`, `messageRead`, `missionComplete`). StoryMissionManager's listener:

1. Evaluates all `conditions[]` via `evaluateCondition()`
2. If all conditions pass, schedules activation via `schedulePendingEvent()`
3. After the configured delay, calls `activateMission(missionId)`
4. Emits `missionAvailable` with the full mission object

The `useStoryMissions` hook catches `missionAvailable`, checks one-time completion, and calls `setAvailableMissions()` to surface it in the UI.

### Phase 3: Acceptance

Player clicks "Accept" on MissionBoard. `GameContext.acceptMission(mission)`:

1. Sets `activeMission` with `status: 'active'`
2. Removes mission from `availableMissions`
3. Registers mission networks in NetworkRegistry
4. Sends `briefingMessage` with NAR credential attachments
5. Initialises all objectives to `status: 'pending'`
6. `useStoryMissions` emits `missionAccepted`

### Phase 4: Objective Tracking

`useObjectiveAutoTracking` subscribes to ~10 game events. On each event:

1. Calls `ObjectiveTracker.checkMissionObjectives(activeMission, gameState)`
2. For each newly-complete objective, emits `objectiveComplete`
3. GameContext updates `activeMission.objectives[].status = 'complete'`

Objectives can complete in any order. Later objectives can complete before earlier ones ("pre-completion" -- shown greyed-out in UI).

### Phase 5: Scripted Events

If the mission JSON defines `scriptedEvents`, StoryMissionManager listens for their triggers (typically `afterObjectiveComplete`). When fired:

1. `ScriptedEventExecutor` runs actions in sequence
2. File operations execute first (blocking player control)
3. Emits `scriptedEventComplete` when done
4. Remaining actions (disconnect, revoke, status change) execute after

### Phase 6: Verification & Completion

A hidden `verification` objective is auto-added by StoryMissionManager. `useStoryMissions` auto-completes it when:

- All required objectives are complete
- Any scripted events have finished (`scriptedEventComplete` received)
- A `VERIFICATION_DELAY_MS` pause has elapsed (narrative breathing room)

When verification completes, GameContext calls `completeMission()`:

1. Calculates payout (basePayout * reputation multiplier)
2. Adds to `completedMissions[]`
3. Clears `activeMission`
4. Emits `missionComplete`
5. Applies credits/reputation changes
6. Revokes networks flagged `revokeOnComplete`
7. Sends payment message with cheque attachment

### Phase 7: Consequences

StoryMissionManager receives `missionComplete` and:

1. Looks up `consequences.success` or `consequences.failure`
2. Schedules each consequence message with its delay
3. Emits `storyEventTriggered` per message
4. `useStoryMissions` resolves templates, delivers to inbox

If `followUpMissions` is defined, the appropriate follow-up mission is activated.

---

## Mission Failure Paths

| Path | Trigger | Flow |
|------|---------|------|
| **Scripted sabotage** | `scriptedEvent` with `setMissionStatus: "failed"` | ScriptedEventExecutor emits `missionStatusChanged` -> GameContext calls `completeMission('failed', ...)` |
| **Critical files deleted** | Player deletes required files | GameContext calls `checkObjectiveImpossible()` -> detects missing files -> emits `missionStatusChanged` |
| **Deadline expired** | `currentTime >= deadlineTime` | GameContext detects expiry -> emits `missionStatusChanged` with `failureReason: 'deadline'` |
| **Manual submit with skips** | Player clicks Submit | Incomplete optional objectives marked `'skipped'` -> mission completes as success with reduced payout |

Failed missions with `retryable: true` become available again after `retryDelay` milliseconds.

---

## Mission JSON Schema

### Root Object

```jsonc
{
  "missionId": "unique-id",           // Required. Unique identifier.
  "title": "Display Title",           // Mission name shown in MissionBoard.
  "description": "Full description",  // Detailed description.
  "category": "story-tutorial",       // "story-tutorial" | "investigation" | "onboarding" | "tutorial-intro" | "decryption"
  "client": "Client Org Name",        // Client organization.
  "difficulty": "Beginner",           // "Beginner" | "Medium" | "Hard"
  "basePayout": 2000,                 // Base credit reward (modified by reputation).
  "oneTime": true,                    // If true, never re-triggers after completion.

  "requirements": {                   // Prerequisites to accept.
    "software": ["vpn-client", "file-manager"],
    "reputation": null,               // Minimum reputation tier (null = none).
    "credits": null                   // Minimum balance (null = none).
  },

  "triggers": { ... },               // When mission activates (see Triggers below).
  "briefingMessage": { ... },         // Message sent on acceptance.
  "networks": [ ... ],               // Network infrastructure provided.
  "objectives": [ ... ],             // What the player must do.
  "scriptedEvents": [ ... ],         // Dramatic automated actions.
  "consequences": { ... },           // Success/failure outcomes.
  "followUpMissions": { ... }        // Chained missions.
}
```

### Triggers

```jsonc
{
  "triggers": {
    "start": {
      "type": "timeSinceEvent",
      "event": "softwareInstalled",      // Event to listen for.
      "condition": { "softwareId": "mission-board" },  // Single condition on event data.
      "conditions": [                    // Multiple conditions (AND logic).
        { "type": "messageRead", "messageId": "msg-welcome" },
        { "type": "softwareInstalled", "softwareId": "mission-board" }
      ],
      "delay": 5000                      // Ms after event before activating.
    }
  }
}
```

**Trigger types used in mission JSON:**

| Type | Listens For | Key Fields |
|------|-------------|------------|
| `timeSinceEvent` | Named game event | `event`, `condition`/`conditions`, `delay` |
| `afterMissionComplete` | Specific mission completing | `missionId`, `delay`, `introMessage` |
| `afterObjectiveComplete` | Specific objective completing | `objectiveId`, `delay` |
| `secureDelete` | Player secure-deleting critical files | `targetFiles` |
| `softwareActivation` | Passive software starting | `softwareId`, `delay` |
| `eventBusEvent` | Any event bus event | `eventName`, `delay` |

### Briefing Message

```jsonc
{
  "briefingMessage": {
    "from": "SourceNet Manager {managerName}",
    "fromId": "SNET-MGR-{random}",
    "fromName": "SourceNet Manager {managerName}",
    "subject": "New Assignment: Log File Repair",
    "body": "Hi {username}, you have a new assignment...",
    "attachments": [
      { "type": "networkCredentials", "networkId": "clienta-corporate", "networkName": "ClientA-Corporate", "address": "192.168.50.0/24" },
      { "type": "softwareLicense", "softwareId": "vpn-client", "softwareName": "VPN Client", "price": 500, "size": 45 },
      { "type": "cheque", "amount": 1000, "deposited": false }
    ]
  }
}
```

**Placeholder variables** (replaced at runtime):
`{username}`, `{managerName}`, `{random}`, `{clientName}`, `{missionTitle}`, `{payoutAmount}`, `{serverName}`, `{networkName}`, `{destinationServer}`, `{targetFilesList}`, `{clientCity}`, `{clientRegion}`, `{clientCountry}`, `{locationType}`, `{chequeAmount}`

### Networks

```jsonc
{
  "networks": [
    {
      "networkId": "westbrook-library",
      "networkName": "Westbrook Library",
      "address": "172.20.0.0/24",
      "bandwidth": 100,                  // Mbps - affects operation speed.
      "revokeOnComplete": true,          // Auto-disconnect + revoke NAR on mission end.
      "revokeReason": "Investigation complete - access revoked",
      "fileSystems": [
        {
          "id": "fs-lib-main-catalog",
          "name": "main-catalog",
          "ip": "172.20.0.10",
          "description": "Main Library Catalog Server",
          "accessible": true,
          "files": [
            { "name": "catalog-database.db", "size": "45 MB", "corrupted": false },
            { "name": "lost-document.pdf", "size": "2 MB", "status": "deleted" },
            { "name": "secret-data.db.enc", "size": "12 MB", "encrypted": true, "algorithm": "aes-256" },  // Requires DecryptionTool
            { "name": "svchost32.exe", "size": "1 MB", "malware": true }   // For secureDelete objectives
          ],
          "logs": [
            {
              "timestamp": -180,           // Negative = before mission start (ms).
              "type": "remote",            // "remote" | "file" | "process" | "system"
              "user": "jthompson_intern",
              "action": "login",           // "login" | "logout" | "access" | "delete" | "execute"
              "fileName": "document.pdf",
              "fileSystemId": "fs-lib-archives",
              "sizeBytes": 47185920,
              "note": "Remote session from 192.168.1.45"
            }
          ]
        }
      ]
    }
  ]
}
```

### Objectives

Every objective has these common fields:

```jsonc
{
  "id": "obj-1",                  // Unique within mission.
  "description": "Player-facing text",
  "type": "objectiveType",        // See table below.
  "required": true,               // false = optional/bonus objective.
  "bonusPayout": 500              // Extra credits for completing optional objectives.
}
```

**Objective type reference:**

| Type | Purpose | Key Fields | Progress | Tracked Via |
|------|---------|-----------|----------|-------------|
| `networkConnection` | Connect to a network | `target` (networkId) | Binary | `activeConnections` |
| `networkScan` | Scan and find machines | `target` (networkId), `expectedResult` or `expectedResults[]` | Binary | `lastScanResults.machines` |
| `fileSystemConnection` | Connect FileManager/DRT to a file system | `target` (IP or fsId), `app` ("fileManager"/"dataRecoveryTool") | Binary | `fileManagerConnections` or `dataRecoveryToolConnections` |
| `fileOperation` | Copy/paste/repair/delete files | `operation`, `targetFiles[]`, `destination` (optional IP) | Count (X/Y) | `missionFileOperations` Sets |
| `narEntryAdded` | Add network to NAR | `target` (networkId) | Binary | `narEntries` |
| `investigation` | View device logs | `correctFileSystemId` | Binary | `viewedDeviceLogs` |
| `dataRecoveryScan` | Scan for deleted files | `target` (fsId) | Binary | `dataRecoveryScans` |
| `fileRecovery` | Restore deleted files | `targetFiles[]` | Count (X/Y) | `missionRecoveryOperations.restored` |
| `secureDelete` | Permanently destroy files | `targetFiles[]` | Count (X/Y) | `missionRecoveryOperations.secureDeleted` |
| `fileDecryption` | Decrypt encrypted files | `targetFiles[]` | Count (X/Y) | `missionDecryptionOperations.decrypted` |
| `fileUpload` | Upload files to remote server | `targetFiles[]`, `destination` (IP) | Count (X/Y) | `missionUploadOperations.uploaded` + `uploadDestinations` |
| `softwareActivation` | Start a passive software | `target` (softwareId) | Binary | `activePassiveSoftware` |
| `avThreatDetected` | AV detects malware in files | `targetFiles[]` | Count (X/Y) | `missionAvDetections` |
| `verification` | Auto-added by system. Never auto-completes -- resolved externally when all others are done. | (none) | Binary | Manual |

**Objective examples:**

```jsonc
// Scan and find two machines
{
  "id": "obj-scan",
  "description": "Scan network to find both servers",
  "type": "networkScan",
  "target": "client-network",
  "expectedResults": ["fileserver-01", "backup-01"]
}

// Paste specific files to a destination
{
  "id": "obj-paste",
  "description": "Transfer files to backup server",
  "type": "fileOperation",
  "operation": "paste",
  "targetFiles": ["report-q1.pdf", "report-q2.pdf"],
  "destination": "192.168.50.20"
}

// Decrypt encrypted files
{
  "id": "obj-decrypt",
  "description": "Decrypt the ticketing database",
  "type": "fileDecryption",
  "targetFiles": ["ticketing-database.db.enc"]
}

// Upload files to a specific destination
{
  "id": "obj-upload",
  "description": "Upload restored database to ticketing server",
  "type": "fileUpload",
  "targetFiles": ["ticketing-database.db"],
  "destination": "10.50.0.10"
}

// Activate passive software
{
  "id": "obj-activate-av",
  "description": "Start the Advanced Firewall & Antivirus",
  "type": "softwareActivation",
  "target": "advanced-firewall-av"
}

// AV threat detection
{
  "id": "obj-av-detect",
  "description": "Antivirus detects malware in decrypted files",
  "type": "avThreatDetected",
  "targetFiles": ["trojan-payload.dat.enc"]
}

// Optional bonus objective
{
  "id": "obj-bonus",
  "description": "Also recover the archived photos",
  "type": "fileRecovery",
  "targetFiles": ["photo-archive.zip"],
  "required": false,
  "bonusPayout": 500
}
```

### Scripted Events

```jsonc
{
  "scriptedEvents": [
    {
      "id": "sabotage-deletion",
      "trigger": {
        "type": "afterObjectiveComplete",
        "objectiveId": "obj-4",
        "delay": 5000
      },
      "actions": [
        {
          "type": "forceFileOperation",
          "operation": "delete",
          "files": "all-repaired",       // Or a number, or "all-corrupted".
          "visual": "progressBar",
          "duration": 15000,
          "playerControl": false          // Block player input.
        },
        {
          "type": "forceDisconnect",
          "network": "clienta-corporate",
          "reason": "Network administrator terminated connection",
          "administratorMessage": "Intrusion detected."
        },
        {
          "type": "revokeNAREntry",
          "network": "clienta-corporate",
          "reason": "Access credentials revoked"
        },
        {
          "type": "setMissionStatus",
          "status": "failed",
          "failureReason": "Critical file destroyed"
        }
      ]
    }
  ]
}
```

**Action types:**

| Action | Effect | Key Fields |
|--------|--------|-----------|
| `forceFileOperation` | Deletes/modifies files with visual animation, blocks player | `operation`, `files`, `visual`, `duration`, `playerControl` |
| `forceDisconnect` | Shows dramatic overlay then disconnects VPN | `network`, `reason`, `administratorMessage` |
| `revokeNAREntry` | Revokes network credentials from NAR | `network`, `reason` |
| `setMissionStatus` | Immediately fails or succeeds the mission | `status`, `failureReason` |
| `sendMessage` | Sends a story message mid-mission | `message`, `templateId`, `eventId` |
| `triggerRansomwareOverlay` | Triggers ransomware attack animation on player's terminal | `duration`, `capacity` |
| `pauseRansomware` | Stops ongoing ransomware attack (e.g., antivirus response) | (none) |
| `addExtensionObjectives` | Dynamically adds new objectives + files mid-mission | `objectives[]`, `files[]` |

### Consequences

```jsonc
{
  "consequences": {
    "success": {
      "credits": 2000,
      "reputation": 0,
      "messages": [
        {
          "delay": 5000,
          "from": "manager",
          "subject": "Good work",
          "templateId": "tutorial-2-success"    // References messageTemplates.js
        }
      ]
    },
    "failure": {
      "credits": -1000,
      "reputation": -1,
      "retryable": true,
      "retryDelay": 60000,
      "messages": [
        { "delay": 3000, "templateId": "tutorial-1-failure" }
      ],
      "messageVariants": {                      // Different messages based on failure reason.
        "incomplete": [ ... ],
        "deadline": [ ... ],
        "filesDeleted": [ ... ]
      }
    }
  }
}
```

### Follow-Up Missions

```jsonc
{
  "followUpMissions": {
    "onSuccess": ["post-tutorial-pool"],
    "onFailure": ["tutorial-part-2"]
  }
}
```

---

## Event/Onboarding Messages (Non-Mission)

Files like `welcome-messages.json` and `investigation-intro.json` use a simpler structure. Instead of objectives and networks, they define an `events[]` array of timed messages:

```jsonc
{
  "missionId": "welcome-messages",
  "category": "onboarding",
  "events": [
    {
      "id": "msg-welcome-hr",
      "trigger": {
        "type": "timeSinceEvent",
        "event": "newGameStarted",
        "delay": 2000
      },
      "message": {
        "from": "SourceNet HR",
        "fromId": "SNET-HR-{random}",
        "fromName": "SourceNet HR",
        "subject": "Welcome aboard!",
        "body": "Hi {username}, welcome to SourceNet..."
      }
    }
  ]
}
```

These fire once per playthrough (tracked via `firedEvents` in StoryMissionManager).

---

## Trigger Event Catalog

Every event type emitted through `triggerEventBus`, where it originates, and what consumes it:

### Game Lifecycle

| Event | Source | Payload | Consumed By |
|-------|--------|---------|-------------|
| `desktopLoaded` | useStoryMissions | `{ username, time }` | Mission triggers |
| `newGameStarted` | useStoryMissions | `{ username, time }` | Mission triggers, onboarding messages |

### Network

| Event | Source | Payload | Consumed By |
|-------|--------|---------|-------------|
| `networkConnected` | VPNClient, useStoryMissions | `{ networkId, networkName }` | Objective tracking, mission triggers |
| `networkDisconnected` | GameContext | `{ networkId }` | FileManager, DRT, LogViewer, objectives |
| `networkRegistryLoaded` | NetworkRegistry | (none) | VPNClient, NAR |
| `networkScanComplete` | NetworkScanner | `{ network, results: { machines } }` | Objective tracking |

### File System

| Event | Source | Payload | Consumed By |
|-------|--------|---------|-------------|
| `fileSystemConnected` | FileManager | `{ fileSystemId, ip, path }` | Objective tracking |
| `fileOperationComplete` | FileManager | `{ operation, filesAffected, fileNames, fileSystem, fileSystemIp }` | Objective tracking |
| `dataRecoveryToolConnected` | DataRecoveryTool | `{ fileSystemId, ip, path }` | Objective tracking |
| `dataRecoveryScanComplete` | DataRecoveryTool | `{ fileSystemId, deletedFiles }` | Objective tracking |
| `fileRecoveryComplete` | DataRecoveryTool | `{ fileName }` | Objective tracking |
| `secureDeleteComplete` | DataRecoveryTool | `{ fileName }` | Objective tracking |
| `deviceLogsViewed` | LogViewer | `{ fileSystemId, deviceIp }` | Objective tracking |
| `fileDecryptionComplete` | DecryptionTool | `{ fileName, decryptedFileName, fileSystemId }` | Objective tracking |
| `fileUploadComplete` | DecryptionTool | `{ fileName, sourceFileName, destinationIp, fileSystemId }` | Objective tracking |
| `avThreatDetected` | useAntivirusScanner | `{ fileName, fileSystemId }` | Objective tracking |

### Mission System

| Event | Source | Payload | Consumed By |
|-------|--------|---------|-------------|
| `missionAvailable` | StoryMissionManager | `{ missionId, mission }` | useStoryMissions, MissionBoard |
| `missionAccepted` | useStoryMissions | `{ missionId }` | Mission triggers, scripted events |
| `missionComplete` | GameContext | `{ missionId, status }` | StoryMissionManager (consequences) |
| `missionDismissed` | GameContext | `{ missionId }` | Mission system |
| `missionManuallySubmitted` | GameContext | `{ missionId }` | Mission system |
| `missionRetryAvailable` | GameContext | `{ missionId }` | Mission system |
| `missionStatusChanged` | ScriptedEventExecutor, GameContext | `{ status, failureReason }` | Mission completion handler |
| `objectiveComplete` | useObjectiveAutoTracking | `{ objectiveId, missionId, objective }` | Scripted event triggers |

### Player Economy

| Event | Source | Payload | Consumed By |
|-------|--------|---------|-------------|
| `creditsChanged` | GameContext, DebugPanel | `{ newBalance }` | Hardware unlock, mission triggers |
| `narEntryAdded` | SNetMail | `{ networkId, networkName }` | Objective tracking |
| `softwareInstalled` | useDownloadManager | `{ softwareId }` | Mission triggers, hardware unlock |
| `passiveSoftwareStarted` | GameContext | `{ softwareId }` | Scripted event triggers |
| `messageRead` | GameContext | `{ messageId }` | Mission triggers, reputation system |

### Scripted Events

| Event | Source | Payload | Consumed By |
|-------|--------|---------|-------------|
| `scriptedEventStart` | StoryMissionManager | `{ eventId, missionId }` | Desktop, useStoryMissions |
| `scriptedEventComplete` | ScriptedEventExecutor | `{ eventId }` | useStoryMissions (verification scheduling) |
| `playerControlBlocked` | ScriptedEventExecutor | `{ blocked: true/false }` | Desktop UI |
| `sabotageFileOperation` | ScriptedEventExecutor | `{ fileName, operation, source }` | FileManager activity log |
| `storyEventTriggered` | StoryMissionManager | `{ message, eventId }` | useStoryMissions (message delivery) |
| `sendMissionIntroMessage` | StoryMissionManager | `{ missionId, message }` | GameContext |
| `forcedDisconnection` | ScriptedEventExecutor | `{ networkId, reason, administratorMessage }` | Desktop overlay |
| `forceNetworkDisconnect` | ScriptedEventExecutor | `{ networkId, reason }` | GameContext |
| `revokeNAREntry` | ScriptedEventExecutor | `{ networkId, reason }` | GameContext |
| `triggerRansomware` | ScriptedEventExecutor | `{ duration, capacity }` | Desktop (overlay) |
| `pauseRansomware` | ScriptedEventExecutor | `{}` | Desktop (overlay) |
| `addMissionExtension` | ScriptedEventExecutor | `{ objectives, files }` | useStoryMissions |
| `ransomwareComplete` | Desktop | `{}` | Mission system |
| `ransomwareCleanupComplete` | Desktop | `{}` | Mission system |
| `ransomwareDecrypted` | RansomwareLockScreen | `{}` | Scripted event triggers |

---

## Message Templates

Defined in `src/missions/messageTemplates.js`. Templates are referenced from mission JSON via `templateId`.

### Existing Template IDs

| Template ID | Category | Purpose |
|-------------|----------|---------|
| `tutorial-1-failure` | Tutorial | Sent after sabotage fails the first mission |
| `tutorial-2-intro` | Tutorial | Introduces the recovery mission |
| `tutorial-2-success` | Tutorial | Acknowledges recovery completion |
| `tutorial-2-nar-info` | Tutorial | Explains NAR revocation mechanics |
| `client-payment` | Economy | Standard payment cheque delivery |
| `back-in-black` | Milestone | Player reaches positive balance |
| `hardware-unlock` | Milestone | Hardware/software upgrades become available |
| `investigation-intro-success` | Investigation | Unlocks investigation-type missions |
| `investigation-failure-retry` | Investigation | Second chance after failed investigation |
| `decryption-tease` | Teaser | Hints at future encryption features |
| `ransomware-rescue` | Ransomware | Manager warns player about ransomware attack on their terminal |
| `ransomware-resolution` | Ransomware | Resolution after antivirus stops the attack |
| `ransomware-decrypted-resolution` | Ransomware | Resolution after player manually decrypts lock screen |
| `ransomware-recovery-success` | Ransomware | Client thanks for recovery work |

### Extension Templates

Used for mid-mission expansions:

| Template ID | Purpose |
|-------------|---------|
| `extension-moreCorruptedFiles` | More corrupted files found |
| `extension-additionalServer` | Corruption spread to another server |
| `extension-newNetworkRepair` | Entirely new network affected |
| `extension-additionalBackupFiles` | More files needed for backup |
| `extension-secondaryBackupServer` | Secondary redundancy required |
| `extension-offsiteBackup` | Offsite facility backup needed |
| `extension-additionalTransferFiles` | More files for transfer |
| `extension-archiveServer` | Archive copy requirement |
| `extension-partnerTransfer` | Partner organization needs copies |

---

## Payout Calculation

From `src/systems/MissionSystem.js`:

```
Final Payout = basePayout * reputationMultiplier + sum(bonusPayout for completed optional objectives)
```

| Reputation Tier | Multiplier |
|----------------|------------|
| 1 | 0.5x |
| 2 | 0.7x |
| 3 | 0.85x |
| 4-5 | 1.0x |
| 6 | 1.1x |
| 7 | 1.2x |
| 8 | 1.3x |
| 9 | 1.5x |
| 10 | 1.7x |
| 11 | 2.0x |

---

## MissionBoard UI (What the Player Sees)

### Tabs
1. **Available** -- Story missions + procedural pool. Shows title, client, badges (STORY, difficulty, chain Part X/Y), payout, expiration countdown, requirements, Accept/Dismiss buttons.
2. **Active** -- Current mission. Shows title, deadline, arc indicator, briefing, and objective checklist with per-file progress.
3. **Failed** -- Failed missions with failure reason, penalty, reputation change, and retry availability.
4. **Completed** -- Successful missions with payout, duration, and reputation earned.

### Objective Display
- Checkbox with description
- `(Optional)` label for non-required objectives
- Progress counter `(2/5 files)` for file operations
- Per-file checklist showing individual file completion status
- Warning icon when files are pasted to wrong destination
- Pre-completed objectives (done before becoming "current") shown greyed-out

---

## Game Context Mission State

Fields from `useGame()` that drive missions:

```javascript
// Core mission state
activeMission              // Current active mission object or null
completedMissions          // Array of {missionId, status, ...} objects
availableMissions          // Array of available story missions

// Tracking state (accumulated during mission)
missionFileOperations      // { copy: Set, paste: Set, repair: Set, delete: Set, pasteDestinations: Map }
missionRecoveryOperations  // { restored: Set, secureDeleted: Set }
missionDecryptionOperations // { decrypted: Set } - tracks decrypted files
missionUploadOperations    // { uploaded: Set, uploadDestinations: Map } - tracks uploads + destinations
missionAvDetections        // Set of file names detected as malware by AV
dataRecoveryScans          // Array of scanned file system IDs
viewedDeviceLogs           // Array of viewed device file system IDs
dataRecoveryToolConnections // Active DRT connections (separate from fileManagerConnections)
activePassiveSoftware      // Array of running passive software IDs

// Context methods
acceptMission(mission)
dismissMission(mission)
completeMissionObjective(objectiveId)
completeMission(status, payout, reputationChange, failureReason)
submitMissionForCompletion()
```

---

## Designing New Missions

### Minimal Story Mission

A mission needs at minimum: `missionId`, `category`, `triggers`, `objectives`, and `consequences`.

```jsonc
{
  "missionId": "my-new-mission",
  "title": "Server Backup",
  "client": "Acme Corp",
  "difficulty": "Medium",
  "basePayout": 3000,
  "category": "story-tutorial",
  "oneTime": true,

  "triggers": {
    "start": {
      "type": "afterMissionComplete",
      "missionId": "previous-mission",
      "delay": 30000
    }
  },

  "briefingMessage": {
    "from": "SourceNet Manager {managerName}",
    "fromId": "SNET-MGR-{random}",
    "subject": "New Job: Server Backup",
    "body": "Hi {username}, Acme Corp needs files backed up..."
  },

  "networks": [
    {
      "networkId": "acme-network",
      "networkName": "Acme Corp",
      "address": "10.0.0.0/24",
      "bandwidth": 75,
      "revokeOnComplete": true,
      "fileSystems": [
        {
          "id": "fs-acme-main",
          "name": "main-server",
          "ip": "10.0.0.10",
          "description": "Main Server",
          "files": [
            { "name": "database.sql", "size": "120 MB" },
            { "name": "config.json", "size": "2 KB" }
          ]
        },
        {
          "id": "fs-acme-backup",
          "name": "backup-server",
          "ip": "10.0.0.20",
          "description": "Backup Server",
          "files": []
        }
      ]
    }
  ],

  "objectives": [
    {
      "id": "obj-1",
      "description": "Connect to Acme Corp network",
      "type": "networkConnection",
      "target": "acme-network"
    },
    {
      "id": "obj-2",
      "description": "Scan to find both servers",
      "type": "networkScan",
      "target": "acme-network",
      "expectedResults": ["main-server", "backup-server"]
    },
    {
      "id": "obj-3",
      "description": "Copy database and config to backup server",
      "type": "fileOperation",
      "operation": "paste",
      "targetFiles": ["database.sql", "config.json"],
      "destination": "10.0.0.20"
    }
  ],

  "consequences": {
    "success": {
      "credits": 3000,
      "reputation": 1,
      "messages": []
    },
    "failure": {
      "credits": -500,
      "reputation": -1,
      "retryable": true,
      "retryDelay": 30000,
      "messages": []
    }
  }
}
```

### Adding Drama (Scripted Events)

Layer in scripted events for mid-mission surprises:

```jsonc
{
  "scriptedEvents": [
    {
      "id": "evt-server-crash",
      "trigger": {
        "type": "afterObjectiveComplete",
        "objectiveId": "obj-3",
        "delay": 3000
      },
      "actions": [
        {
          "type": "forceFileOperation",
          "operation": "delete",
          "files": 2,
          "duration": 10000,
          "playerControl": false
        },
        {
          "type": "forceDisconnect",
          "network": "acme-network",
          "reason": "Server crash detected",
          "administratorMessage": "Critical failure. All connections terminated."
        }
      ]
    }
  ]
}
```

### Investigation Missions

Use `logs` on file systems and `investigation` objectives:

```jsonc
{
  "objectives": [
    {
      "id": "obj-investigate",
      "description": "Check server logs to find what happened",
      "type": "investigation",
      "correctFileSystemId": "fs-acme-main"
    },
    {
      "id": "obj-recover",
      "description": "Recover deleted files",
      "type": "fileRecovery",
      "targetFiles": ["database.sql", "config.json"]
    }
  ]
}
```

### Extension Objectives (Mid-Mission Expansion)

Use `addExtensionObjectives` scripted events to dynamically add new objectives and files after the player reaches a certain point. This enables multi-phase missions where later stages are revealed during gameplay.

```jsonc
{
  "scriptedEvents": [
    {
      "id": "evt-extension",
      "trigger": {
        "type": "afterObjectiveComplete",
        "objectiveId": "obj-upload-scheduling",
        "delay": 5000
      },
      "actions": [
        {
          "type": "sendMessage",
          "templateId": "extension-additionalServer",
          "eventId": "msg-extension"
        },
        {
          "type": "addExtensionObjectives",
          "objectives": [
            {
              "id": "obj-decrypt-trap",
              "description": "Decrypt the suspicious file",
              "type": "fileDecryption",
              "targetFiles": ["suspicious-file.db.enc"]
            }
          ],
          "files": [
            {
              "fileSystemId": "fs-target-server",
              "files": [
                { "name": "suspicious-file.db.enc", "size": "8 MB", "encrypted": true, "algorithm": "aes-256" }
              ]
            }
          ]
        }
      ]
    }
  ]
}
```

The `addExtensionObjectives` action emits `addMissionExtension` on the event bus, which `useStoryMissions` catches to merge new objectives and files into the active mission. Pair with a `sendMessage` action to give the player narrative context for the new objectives.

### Registering a New Mission

1. Create your JSON file in `src/missions/data/`
2. Import it in `src/missions/missionData.js`
3. Add it to the exported missions array
4. If it references new templates, add them to `messageTemplates.js`

### Things to Keep in Mind

- **Verification objective**: StoryMissionManager auto-adds one. Don't define `type: "verification"` in your JSON unless you have a special reason.
- **Network IDs must be unique** across all missions.
- **File system IDs must be unique** across all missions.
- **`revokeOnComplete: true`**: Use this for missions where the player shouldn't retain access afterward.
- **Cumulative file tracking**: `fileOperation` objectives track unique files. Pasting the same file twice doesn't count double.
- **Pre-completion**: Players can complete later objectives before earlier ones. The UI handles this gracefully.
- **Game time**: All delays are in game-time milliseconds and scale with time speed.
- **`oneTime: true`**: Story missions should almost always be one-time. Checked against `completedMissions[].missionId`.

---

## Procedural Mission System

`src/missions/MissionGenerator.js` generates complete procedural missions with network infrastructure, file systems, objectives, and briefing messages. `src/missions/MissionPoolManager.js` manages the pool lifecycle.

### Progression Levels

| Level | Trigger | Pool Size | Mission Types |
|-------|---------|-----------|---------------|
| `early` | Tutorial complete | 4-6 | repair, backup, transfer |
| `midGame` | `investigation-missions` unlocked | 6-10 | + investigation-repair, investigation-recovery, secure-deletion |
| `lateGame` | `decryption-missions` unlocked | 8-12 | + decryption, decryption-repair, decryption-backup, investigation-decryption, multi-layer-decryption, decryption-malware, virus-hunt |

Each level guarantees at least one mission of its new type category exists in the pool.

### Industries

banking, government, healthcare, corporate, utilities, shipping, emergency, nonprofit, cultural -- each with industry-specific file templates for repair, backup, transfer, and decryption mission types.

### Chain Templates (Multi-Mission Arcs)

- `escalation` -- Problem reveals deeper issues (3 parts)
- `discovery` -- Routine work uncovers problems (2 parts)
- `migration` -- System migration project (3 parts)
- `audit` -- Compliance audit preparation (2 parts)

### Key Files

| File | Responsibility |
|------|---------------|
| `src/missions/MissionGenerator.js` | All procedural mission generators, network infrastructure, file generation |
| `src/missions/MissionPoolManager.js` | Pool lifecycle, progression levels, refresh logic |
| `src/missions/MissionExtensionGenerator.js` | Mid-mission extension objectives |
| `src/data/clientRegistry.js` | Client definitions with industry, reputation requirements |
