# SourceNet - Phase 2 Design Specification

## Overview
Phase 2 introduces the core gameplay loop to SourceNet. Players can now accept missions from the SourceNet Mission Board, purchase software applications, and earn credits through ethical hacking contracts. This phase transforms SourceNet from a simulation into a playable game with progression and objectives.

**Note:** Hardware purchasing is deferred to Phase 3+. Phase 2 focuses on software and mission gameplay.

**Phase 2 Focus:** Core Gameplay - Missions & Hacking Mechanics (Moderate Complexity)

---

## Key Features

### Core Gameplay
- **Mission/Contract System** - Accept and complete missions from SourceNet
- **Tutorial Mission** - First mission explains VPN usage, secure networks, and software requirements
- **Hacking Gameplay** - Multi-step missions with moderate complexity
- **Mission Board Application** - Browse available contracts and view mission history

### Economy & Progression
- **Software Purchasing** - Buy software applications from Portal (Phase 2)
- **Hardware Purchasing** - NOT in Phase 2 (Phase 3+)
- **Installation System** - Download and install software (with simulated download speeds, bandwidth sharing)
- **Transaction History** - Banking app tracks all financial activity
- **Software Storage** - All software takes SSD space, displayed in app launcher

### New Applications
- **SourceNet VPN Client** - Required for accessing secure mission networks ($500, free license in tutorial)
- **SourceNet Mission Board** - View and accept SourceNet contracts ($250, free license from manager)
- **Network Address Register** - Manage network connections ($200, free license in tutorial)
- **Network Scanner** - Scan networks for machines/file systems ($300, free license in tutorial)
- **File Manager** - Access and manipulate files on network file systems ($350, free license in tutorial)

**Note:** All prices shown in Portal even for licensed software. Free licenses show "Licensed" badge + price.

---

## Phase 2 Architecture

### New Game Systems

#### 1. Mission System
- **Mission Board:** Central hub for viewing available missions (requires license from manager)
- **Mission Types:** File restoration, file repair (Phase 2 basic types only)
- **Mission Requirements:** Some missions require specific software
- **Mission Progress:** Track current mission objectives
- **Mission Completion:** AUTOMATIC when objectives complete (no manual submit)
- **Mission History:** View completed missions and earnings
- **Mission Gating:** Reputation affects payouts and client types (not just access)

#### 2. Purchasing System (SOFTWARE ONLY)
- **Phase 2 Scope:** Software purchasing only (no hardware)
- **Hardware Purchasing:** Phase 3+
- **Purchase Confirmation:** Modal confirms purchase before deducting credits
- **Insufficient Funds:** Clear messaging when player cannot afford item
- **Installation Queue:** Track downloads and installations in progress
- **Storage Requirements:** Each software shows required SSD space in Portal

#### 3. Installation System
- **Download Simulation:** Progress based on available network bandwidth
- **Bandwidth Sharing:** Multiple simultaneous actions share bandwidth equally
- **Download Progress:** Visual indicator showing download percentage
- **Installation Process:** Brief installation step after download completes
- **Software Ready:** Software available immediately after installation
- **Storage Consumption:** Software takes up SSD space (shown in app launcher)

#### 4. Reputation System
- **Purpose:** Track player's performance as SourceNet agent
- **Function:** Affects mission payouts and client types (not just access)
- **11 Reputation Tiers:** From "Should be let go" to "Star employee"
- **Starting Value:** Superb (tier 9) - impressed during interview
- **Changes:** Mission success/failure affects reputation
- **Display:** Icon with color coding in top bar
- **Mission Gating:** Higher reputation = higher payouts, better client types (Banks need high rep, Libraries/Museums more lenient)
- **Warning System:** "On performance plan" (Tier 2) triggers warning message
- **Game Over Risk:** "Should be let go" (Tier 1) = 10 minutes to complete mission or fired by SourceNet
- **Mission Board Display:** Shows missions out of reputation range (greyed) to motivate improvement

#### 5. Bankruptcy System
- **Overdraft Allowed:** Bank account can go negative
- **Interest Rate:** 1% per minute of in-game time while overdrawn
- **Bankruptcy Trigger:** Overdrawn by >10,000 credits for 5 consecutive minutes
- **Warning System:** 5-minute countdown with red flashing banner in top bar
- **Audio Alerts:**
  - Each minute during countdown
  - **Every second once countdown hits 10 seconds** (intense final warning)
- **Bank Messages:** Warnings sent as overdraft worsens
- **Game Over:** SourceNet informed by bank, assets seized by financial authorities
- **Game Over Message:** "SourceNet has been notified of your bankruptcy. Your assets have been seized by financial authorities. You are no longer able to work as a SourceNet agent."
- **Tutorial Impact:** Player forced into -9,000 debt, creates urgency

#### 6. Software Attachment System
- **Message Attachments:** Can include software licenses and Network Address Register entries
- **Software Licenses:** Click attachment to add free license to Portal account
- **Network Address Register Entries:** Click attachment to add network to NAR (not automatic)
- **Installation Required:** Player must visit Portal to download/install licensed software
- **Portal Display:** Shows actual price + "Licensed" badge for owned licenses
- **Tutorial Usage:** Manager sends Mission Board license first, then VPN Client, Network Scanner, NAR, File Manager after tutorial accepted

#### 7. Software Storage System
- **All Software Uses Space:** Every installed application consumes SSD storage
- **OSNet OS:** Takes significant base storage (~10-15 GB)
- **Individual Apps:** Each shows required space in Portal (e.g., "Requires 500 MB")
- **App Launcher Display:** Bottom shows "X GB used / Y GB free"
- **Storage Limits:** Based on installed SSD (starting: 90GB SSD)
- **Phase 2:** View-only (cannot manage/delete software yet)

#### 8. Network Bandwidth System
- **Connection Bandwidth:** Network connections have speed limits (e.g., 50 Mbps typical)
- **Your Network Adapter:** Starting 250 Mbps adapter
- **Bandwidth Sharing:** Multiple simultaneous actions share bandwidth equally
- **Actions Using Bandwidth:**
  - Downloading software
  - Copying files between network locations
  - (Future: Scanning networks, transferring data)
- **Always Available:** Can always connect/download, just slower when bandwidth shared
- **Example:** Copying files while downloading = each gets 50% of available bandwidth

---

## Save System (Detailed Specification)

**Purpose:** Extend Phase 1 save system to support Phase 2 state while maintaining simplicity

**Design Philosophy:** Manual cleanup before save - player ensures clean state

**Key Decision:** Single save state (not split storage) - optimal for Phase 2-3 scale

### Save Restrictions - Manual Preparation Required

**Save Enabled ONLY When ALL Conditions Met:**

**1. No Active Network Connections**
- Player must manually disconnect from ALL networks
- VPN Client shows "No active connections"
- Top bar network indicator badge shows "0"
- Player action: Open VPN Client, click "Disconnect" on each network

**2. No Operations In Progress**
- No file operations: copying, repairing, deleting
- No network scans: Quick scan or Deep scan
- No downloads: Software downloads must complete or be cancelled
- No installations: Software installations must finish
- Progress bars: None visible anywhere

**3. No Scripted Events Active**
- Not during tutorial sabotage (file deletion sequence)
- Not during forced disconnections
- Not during any story-driven scripted sequences

**4. Not During Mission Auto-Completion**
- Not during "Mission Completing..." verification phase (3-5 seconds)
- Must wait for final SUCCESS or FAILED status

### Save Button UI

**Power Menu - Save Option:**

```
IF save conditions not met:

  Save [GREYED OUT]

  Hover tooltip shows reason:
  - "Disconnect from all networks before saving"
  - "Complete file operation before saving"
  - "Complete download before saving"
  - "Cannot save during mission events"
  - "Wait for mission completion to finish"

IF save conditions met:

  Save [ACTIVE]

  Click → Save dialog opens
  Player can name save or use auto-name (in-game date/time)
```

**Player Learning:**
- Teaches "clean state" habit
- Encourages completing operations before saving
- Predictable save experience
- No unexpected data loss

### State Preserved (Complete Structure)

**Phase 2 Save State (Single JSON Object):**

```javascript
{
  // ========== METADATA ==========
  saveId: "save-1234-5678",
  saveVersion: "2.0",  // For future migration compatibility
  username: "agent_5678",
  saveTimestamp: "2024-12-29T10:30:00Z",  // Real-world time
  saveName: "After first mission success",  // Player-provided or auto

  // ========== PLAYER STATE ==========
  player: {
    credits: -8000,
    reputation: 3,  // Tier number (1-11)
    reputationName: "Accident prone"  // For display
  },

  // ========== TIME SYSTEM ==========
  time: {
    currentTime: "25/03/2020 14:30:00",
    timeSpeed: 1  // Always resets to 1x on load (Phase 1 behavior)
  },

  // ========== HARDWARE (Phase 1) ==========
  hardware: {
    cpu: {id: "cpu-1ghz", name: "1GHz Single Core", power: 65},
    memory: {id: "ram-2gb", name: "2GB RAM", power: 3},
    storage: {id: "ssd-90gb", name: "90GB SSD", capacity: 90, power: 2},
    motherboard: {id: "basic-board", slots: {...}, power: 1},
    psu: {id: "psu-300w", wattage: 300},
    networkAdapter: {id: "net-250mb", speed: 250, power: 5}
  },

  // ========== SOFTWARE ==========
  software: {
    installed: [
      {id: "osnet", name: "OSNet", size: 12.0, canRemove: false},
      {id: "portal", name: "OSNet Portal", size: 0.5, canRemove: false},
      {id: "mail", name: "SNet Mail", size: 0.3, canRemove: false},
      {id: "banking", name: "SNet Banking", size: 0.2, canRemove: false},
      {id: "mission-board", name: "SourceNet Mission Board", size: 0.2, canRemove: true},
      {id: "vpn-client", name: "SourceNet VPN Client", size: 0.5, canRemove: true},
      {id: "network-scanner", name: "Network Scanner", size: 0.3, canRemove: true},
      {id: "file-manager", name: "File Manager", size: 0.4, canRemove: true},
      {id: "nar", name: "Network Address Register", size: 0.15, canRemove: true}
    ],
    totalStorageUsed: 14.55,  // GB
    totalStorageAvailable: 90
  },

  // ========== MESSAGES ==========
  messages: [
    {
      id: "msg-001",
      from: "hr",
      fromId: "SNET-HQ0-000-001",
      fromName: "SourceNet Human Resources",
      subject: "Welcome to SourceNet!",
      body: "...",
      timestamp: "25/03/2020 09:00:02",
      read: true,
      archived: false,
      attachments: []
    },
    {
      id: "msg-002",
      from: "manager",
      fromId: "SNET-MGR-A45-B23",
      fromName: "Alex",
      subject: "Hi from your manager - Alex",
      body: "...",
      timestamp: "25/03/2020 09:00:05",
      read: true,
      archived: false,
      attachments: [
        {type: "cheque", amount: 1000, status: "deposited"}
      ]
    },
    // ... 50-100+ messages accumulate over gameplay
  ],

  // ========== TRANSACTIONS ==========
  transactions: [
    {
      id: "txn-001",
      date: "25/03/2020 10:00:00",
      type: "income",
      amount: 1000,
      description: "Cheque Deposit",
      balanceAfter: 1000
    },
    {
      id: "txn-002",
      date: "25/03/2020 11:30:00",
      type: "expense",
      amount: -10000,
      description: "Mission Failure Penalty: Log File Repair",
      balanceAfter: -9000
    },
    {
      id: "txn-003",
      date: "25/03/2020 11:31:00",
      type: "expense",
      amount: -90,
      description: "Overdraft Interest (1 min)",
      balanceAfter: -9090
    },
    // ... 100-200+ transactions (interest every minute adds up!)
  ],

  // ========== MISSIONS ==========
  missions: {
    active: {
      missionId: "file-backup-05",
      title: "Backup Configuration Files",
      client: "Client C - RetailCorp",
      difficulty: "Easy",
      basePayout: 1000,
      startTime: "25/03/2020 13:00:00",
      objectives: [
        {id: "obj-1", description: "Connect to network", status: "complete"},
        {id: "obj-2", description: "Scan network", status: "complete"},
        {id: "obj-3", description: "Connect to file system", status: "complete"},
        {id: "obj-4", description: "Copy files (0/5)", status: "in-progress"},
        {id: "obj-5", description: "Verify completion", status: "pending"}
      ]
    },  // OR null if no active mission

    completed: [
      {
        id: "tutorial-part-1",
        title: "Log File Repair",
        status: "failed",
        completionTime: "25/03/2020 11:30:00",
        duration: 30,  // minutes
        payout: -10000,
        reputationChange: -6,
        tier: null
      },
      // ... 15-30 completed missions
    ]
  },

  // ========== NETWORK STATE ==========
  network: {
    narEntries: [
      {
        id: "nar-001",
        networkId: "clienta-corporate",
        networkName: "ClientA-Corporate",
        address: "10.50.0.0/16",
        status: "expired",
        dateAdded: "25/03/2020 11:00:00",
        expirationDate: "25/03/2020 12:15:00",
        relatedMission: "tutorial-part-1"
      },
      // ... 5-15 NAR entries
    ],
    activeConnections: []  // ALWAYS EMPTY (save restriction enforced)
  },

  // ========== TIMERS & COOLDOWNS ==========
  timers: {
    missionCooldowns: {
      easy: null,
      medium: {nextAvailable: "25/03/2020 14:45:00"},
      hard: null
    },
    bankruptcyCountdown: null,  // OR {startTime, endTime, remaining}
    reputationCountdown: null   // OR {startTime, endTime, remaining}
  },

  // ========== UI STATE (Phase 1) ==========
  ui: {
    openWindows: [],      // Can preserve window positions if desired
    minimizedWindows: []  // Can preserve minimized state
  },

  // ========== TRANSIENT STATE (Always Empty) ==========
  transient: {
    downloadQueue: [],           // ALWAYS EMPTY (save restriction)
    fileManagerClipboard: null,  // ALWAYS EMPTY (no File Managers open)
    networkScanResults: {},      // ALWAYS EMPTY (scans complete before save)
    activeOperations: []         // ALWAYS EMPTY (operations complete before save)
  }
}
```

**Estimated Sizes:**
- After tutorial: ~150 KB
- After 10 missions: ~200 KB
- After 30 missions: ~300 KB
- **Well within limits**

### Single Save State - Implementation

**Save Function:**
```javascript
const saveGame = (saveName) => {
  // Validate save conditions (already checked by UI)
  if (!canSave()) {
    throw new Error('Invalid save state');
  }

  const saveState = {
    saveId: generateSaveId(),
    saveVersion: "2.0",
    username: gameState.username,
    saveTimestamp: new Date().toISOString(),
    saveName: saveName || generateAutoName(gameState.currentTime),

    player: {
      credits: gameState.credits,
      reputation: gameState.reputation,
      reputationName: getReputationName(gameState.reputation)
    },

    time: {
      currentTime: gameState.currentTime,
      timeSpeed: 1  // Always save as 1x (resets on load)
    },

    hardware: gameState.hardware,
    software: gameState.software,
    messages: gameState.messages,
    transactions: gameState.transactions,
    missions: gameState.missions,
    network: gameState.network,
    timers: gameState.timers,
    ui: gameState.ui,

    // Transient always empty due to save restrictions
    transient: {
      downloadQueue: [],
      fileManagerClipboard: null,
      networkScanResults: {},
      activeOperations: []
    }
  };

  // Serialize and save
  const saveJson = JSON.stringify(saveState);
  localStorage.setItem(`sourcenet-save-${saveState.saveId}`, saveJson);

  return saveState.saveId;
};
```

**Load Function:**
```javascript
const loadGame = (saveId) => {
  const saveJson = localStorage.getItem(`sourcenet-save-${saveId}`);
  if (!saveJson) {
    throw new Error('Save not found');
  }

  const saveState = JSON.parse(saveJson);

  // Version check for future migrations
  if (saveState.saveVersion !== "2.0") {
    saveState = migrateSave(saveState);
  }

  // Restore state
  setGameState({
    ...saveState,
    time: {
      ...saveState.time,
      timeSpeed: 1  // Always load at 1x speed
    },
    transient: {
      downloadQueue: [],
      fileManagerClipboard: null,
      networkScanResults: {},
      activeOperations: []
    }
  });

  // Resume timers if active
  if (saveState.timers.bankruptcyCountdown) {
    resumeBankruptcyCountdown(saveState.timers.bankruptcyCountdown);
  }
  if (saveState.timers.reputationCountdown) {
    resumeReputationCountdown(saveState.timers.reputationCountdown);
  }

  // Resume interest calculation if overdrawn
  if (saveState.player.credits < 0) {
    startInterestAccumulation();
  }
};
```

### Why Single Save State Works

**Phase 2-3 Scale:**
- Messages: 50-100 (~100-200 KB)
- Transactions: 100-200 (~50-100 KB)
- Missions: 20-50 (~40-100 KB)
- Core: ~10-20 KB
- **Total: 200-420 KB per save**

**Browser Limits:**
- localStorage: 5-10 MB per domain
- **Room for 12-50 save files** comfortably

**Performance:**
- Save (stringify + write): <20ms
- Load (read + parse): <15ms
- **Imperceptible to player**

**Future Expansion:**
- Phase 3 adds hardware purchases: +10-20 KB
- Phase 4 adds more content: +50-100 KB
- **Still well within limits at 500-600 KB**

**When to Split:**
- Only if exceeds 1 MB per save (Phase 5+?)
- Only if performance drops below 50ms
- Only if approaching localStorage limits
- **Not a concern for Phase 2-4**

---

## Phase 2 End State Philosophy

**Purpose:** Phase 2 is a development milestone, not a gameplay achievement

### Phases Are Development Organization Tools

**Phase Definition:**
- **Phase 1:** Core infrastructure (boot, desktop, save, basic apps)
- **Phase 2:** Gameplay loop (missions, economy, progression systems)
- **Phase 3:** Expansion (hardware, new mission types, additional OS)
- **Phase 4+:** Advanced features

**NOT Gameplay Milestones:**
- No "Phase 2 Complete!" celebration needed
- No forced victory conditions
- No artificial endpoints
- Player progresses naturally

### Phase 2 End State - Variable & Acceptable

**Player Can Finish Phase 2 In Any State:**

**Scenario A: Struggling**
- Credits: -6,000 (still recovering)
- Reputation: Tier 4 "Can work with help"
- Missions: 8 completed
- **Valid:** Player still learning, can continue

**Scenario B: Typical**
- Credits: +1,000 (broke even, small reserve)
- Reputation: Tier 5-6 "OK" / "Semi-competent"
- Missions: 12-15 completed
- **Valid:** Most common end state

**Scenario C: Successful**
- Credits: +10,000 (fully recovered)
- Reputation: Tier 7-8 "Reliable" / "High achiever"
- Missions: 20-25 completed
- **Valid:** Skilled player

**Scenario D: Grinding**
- Credits: +50,000 (maximizing earnings)
- Reputation: Tier 10-11 "Ace agent" / "Star employee"
- Missions: 50+ completed
- **Valid:** Player choice to keep playing

**All States Transition Cleanly to Phase 3**

### "Boring" End State Is Intentional

**Why Repetitive Missions Are OK:**

1. **Development Focus:** Prove systems work, not entertain endlessly
2. **Foundation Testing:** Reputation/bankruptcy thoroughly validated through repetition
3. **Phase 3 Ready:** Clean base to add variety (new mission types, hardware)
4. **Player Freedom:** Stop when satisfied, continue if desired

**Manager's Message (When Breaking Even):**
```
From: [Manager Name]
Subject: Back in the Black

[username],

Good work. You're out of debt.

There's more file restoration work available if you want to keep building
your reserves and reputation. Same kind of stuff, but the credits add up.

When you're ready for more interesting work, I'll have it for you.

- [Manager Name]
```

**No "You Won!" - Just acknowledgment**

### Clean Base for Phase 3 ✅

**No Loose Ends:**
- ✓ All systems self-contained
- ✓ No temporary code or hacks
- ✓ No "TODO: Fix in Phase 3"
- ✓ Save system handles Phase 3 state additions
- ✓ Story mission system ready for new missions
- ✓ Purchasing system ready for hardware (just enable it)
- ✓ No architectural refactoring needed

**Phase 3 Can Add:**
- Hardware purchasing (Portal already shows hardware catalog)
- New mission types (PassBreaker, Vulnerability Scanner, etc.)
- Additional OS (theme system ready from Phase 1)
- More VPN clients (architecture supports multiple)
- Message deletion (UI ready, just enable functionality)
- Storage management (uninstall software)

**No Breaking Changes:**
- Phase 2 systems remain unchanged
- Phase 3 extends, doesn't replace
- Backward compatible saves (version checking)

### Storage Management - Not a Concern

**Phase 2 Software:**
- OSNet: 12 GB
- 8 apps: ~2.5 GB
- **Total: ~14.5 GB used of 90 GB**
- **75.5 GB free (84% available)**

**Even with additional software purchases:**
- Unlikely to exceed 20-25 GB used
- Plenty of space remaining
- Phase 3 will add storage management

**No action needed in Phase 2**

---

## Story Mission System (Architecture)

**Purpose:** Separate scripted story missions from core gameplay code for maintainability and testability

**Design Philosophy:**
- Story missions are **data-driven configurations**, not hardcoded logic
- Core game provides **trigger events** that story missions listen for
- Story missions can be added/modified without changing core game code
- Testing focuses on trigger system, not story content

### Story Mission Structure

**Story Mission Definition (JSON/Data Format):**

```json
{
  "missionId": "tutorial-part-1",
  "title": "Log File Repair",
  "client": "Client A - TechCorp Industries",
  "difficulty": "Beginner",
  "basePayout": 2000,
  "category": "story-tutorial",

  "triggers": {
    "start": {
      "type": "timeSinceEvent",
      "event": "missionBoardInstalled",
      "delay": 0
    }
  },

  "requirements": {
    "software": ["vpn-client", "network-scanner", "file-manager"],
    "reputation": null,
    "credits": null
  },

  "objectives": [
    {
      "id": "obj-1",
      "description": "Connect to ClientA-Corporate network",
      "type": "networkConnection",
      "target": "clienta-corporate",
      "completionCheck": "isConnectedToNetwork"
    },
    {
      "id": "obj-2",
      "description": "Scan network to find fileserver-01",
      "type": "networkScan",
      "target": "clienta-corporate",
      "expectedResult": "fileserver-01",
      "completionCheck": "hasScanResult"
    },
    {
      "id": "obj-3",
      "description": "Connect to fileserver-01 file system",
      "type": "fileSystemConnection",
      "target": "192.168.50.10",
      "completionCheck": "isConnectedToFileSystem"
    },
    {
      "id": "obj-4",
      "description": "Repair all corrupted files",
      "type": "fileOperation",
      "operation": "repair",
      "target": "all-corrupted",
      "count": 8,
      "completionCheck": "allFilesRepaired"
    }
  ],

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
          "files": "all-repaired",
          "visual": "progressBar",
          "duration": 10000,
          "playerControl": false
        },
        {
          "type": "forceDisconnect",
          "network": "clienta-corporate",
          "reason": "Network administrator terminated connection"
        },
        {
          "type": "setMissionStatus",
          "status": "failed",
          "failureReason": "Files deleted instead of repaired"
        }
      ]
    }
  ],

  "consequences": {
    "success": {
      "credits": 2000,
      "reputation": 0,
      "messages": []
    },
    "failure": {
      "credits": -10000,
      "reputation": -6,
      "messages": [
        {
          "id": "manager-angry",
          "delay": 10000,
          "from": "manager",
          "subject": "What happened?!",
          "templateId": "tutorial-1-failure"
        }
      ],
      "note": "Bank overdraft message triggered by Banking System (not story mission)"
    }
  },

  "followUpMissions": {
    "onSuccess": [],
    "onFailure": ["tutorial-part-2"]
  }
}
```

**Important Note:** The bank overdraft message is triggered by the **Banking System**, not the story mission. When `creditsChanged` event fires and balance < 0, the banking system sends the overdraft notice. This keeps banking logic in the banking system, separate from mission stories.

---

## Core System Messages (Non-Story)

**Purpose:** Game systems send their own messages based on system state, independent of story missions

**Banking System Messages:**

**Triggered by creditsChanged event:**
```javascript
// In BankingSystem.js (core game code)
const handleCreditsChanged = (newBalance, oldBalance) => {
  // First overdraft
  if (newBalance < 0 && oldBalance >= 0) {
    sendBankMessage('first-overdraft', {
      balance: newBalance,
      interestRate: '1% per minute'
    });
  }

  // Approaching bankruptcy
  if (newBalance < -8000 && newBalance > -10000) {
    sendBankMessage('approaching-bankruptcy', {
      balance: newBalance,
      threshold: -10000
    });
  }

  // Bankruptcy countdown started
  if (newBalance <= -10000 && !bankruptcyCountdownActive) {
    startBankruptcyCountdown();
    sendBankMessage('bankruptcy-countdown-start', {
      balance: newBalance,
      timeRemaining: 5
    });
  }
};
```

**Banking Message Templates:**
- `first-overdraft` - Sent when account first goes negative
- `approaching-bankruptcy` - Warning when getting close to -10k
- `bankruptcy-countdown-start` - Urgent notice when countdown begins
- `bankruptcy-final-warning` - Sent at 1 minute remaining
- `bankruptcy-cancelled` - Confirmation when back above -10k

**Reputation System Messages:**

**Triggered by reputationChanged event:**
```javascript
// In ReputationSystem.js
const handleReputationChanged = (newTier, oldTier) => {
  // Warning at Tier 2
  if (newTier === 2 && oldTier > 2) {
    sendHRMessage('performance-plan-warning', { tier: newTier });
  }

  // Final warning at Tier 1
  if (newTier === 1) {
    startReputationCountdown();
    sendHRMessage('final-termination-warning', {
      tier: newTier,
      timeRemaining: 10
    });
  }

  // Recovered from Tier 1
  if (newTier > 1 && oldTier === 1) {
    cancelReputationCountdown();
    sendHRMessage('performance-improved', { tier: newTier });
  }
};
```

**HR Message Templates:**
- `performance-plan-warning` - Sent when dropping to Tier 2
- `final-termination-warning` - Sent when dropping to Tier 1
- `performance-improved` - Sent when improving from Tier 1

**Benefits:**
- Banking/HR logic stays in respective systems
- Story missions don't need to know about banking rules
- Messages consistent across all scenarios (not just specific missions)
- Easy to test banking system independently

---

## Phase 1 Event Conversion

**Purpose:** Convert Phase 1 scripted messages to use new story event architecture

**Current Phase 1 Scripted Events (Hardcoded):**

1. **HR Welcome Message** - 2 seconds after desktop loads
2. **Manager Welcome Message** - 2 seconds after HR message read (includes 1,000 credit cheque)

**Conversion to Story Event System:**

These should become story event definitions that use the trigger system, maintaining backward compatibility.

### Phase 1 Story Event Definition

**File:** `src/missions/data/phase1-welcome.json`

```json
{
  "eventId": "phase1-welcome",
  "category": "onboarding",
  "events": [
    {
      "id": "hr-welcome",
      "trigger": {
        "type": "timeSinceEvent",
        "event": "desktopLoaded",
        "delay": 2000
      },
      "message": {
        "from": "hr",
        "fromId": "SNET-HQ0-000-001",
        "fromName": "SourceNet Human Resources",
        "subject": "Welcome to SourceNet!",
        "templateId": "hr-welcome",
        "attachments": []
      }
    },
    {
      "id": "manager-welcome",
      "trigger": {
        "type": "afterMessageRead",
        "messageId": "hr-welcome",
        "delay": 2000
      },
      "message": {
        "from": "manager",
        "fromId": "SNET-MGR-{random}",
        "fromName": "{randomFirstName}",
        "subject": "Hi from your manager - {managerName}",
        "templateId": "manager-welcome",
        "attachments": [
          {
            "type": "cheque",
            "amount": 1000
          }
        ]
      }
    }
  ]
}
```

**Phase 2 Mission Board License:**

**File:** `src/missions/data/phase2-mission-board-intro.json`

```json
{
  "eventId": "phase2-mission-board-intro",
  "category": "phase2-intro",

  "events": [
    {
      "id": "mission-board-license",
      "trigger": {
        "type": "timeSinceEvent",
        "event": "messageRead",
        "messageId": "manager-welcome",
        "delay": 20000
      },
      "message": {
        "from": "manager",
        "subject": "Get Ready for Your First Mission",
        "templateId": "mission-board-license",
        "attachments": [
          {
            "type": "softwareLicense",
            "softwareId": "mission-board"
          }
        ]
      }
    }
  ]
}
```

### Core Game System Triggers

**Banking System Triggers:**
```javascript
// Banking system emits events based on balance changes
triggerEventBus.emit('creditsChanged', {
  oldBalance: previousCredits,
  newBalance: currentCredits,
  change: currentCredits - previousCredits,
  source: 'mission-payout' | 'purchase' | 'interest' | 'penalty'
});

// Banking system handles own messages
if (newBalance < 0 && oldBalance >= 0) {
  messageSystem.sendSystemMessage('bank', 'first-overdraft', { balance: newBalance });
}
```

**Reputation System Triggers:**
```javascript
// Reputation system emits events based on tier changes
triggerEventBus.emit('reputationChanged', {
  oldTier: previousTier,
  newTier: currentTier,
  oldName: getTierName(previousTier),
  newName: getTierName(currentTier),
  source: 'mission-success' | 'mission-failure'
});

// Reputation system handles own messages
if (newTier === 2 && oldTier > 2) {
  messageSystem.sendSystemMessage('hr', 'performance-plan-warning', { tier: newTier });
}
```

### Separation of Concerns

**Story Mission Events:**
- Mission-specific content
- Manager guidance messages
- Tutorial walkthroughs
- Special mission events (sabotage)
- Defined in `src/missions/data/`

**Core System Events:**
- Banking messages (overdraft, bankruptcy)
- HR messages (reputation warnings)
- Game system notifications
- Defined in respective system files (BankingSystem.js, ReputationSystem.js)

**Benefits:**
- Banking logic stays in banking code
- Reputation logic stays in reputation code
- Story missions only contain story-specific events
- Systems work independently
- Easier to test each system in isolation

### Phase 1 Migration Plan

**Backward Compatibility:**
- Phase 1 events converted to story event JSON
- No changes to player experience
- Same timing, same messages, same behavior

**Migration Steps:**
1. Create `phase1-welcome.json` with HR and Manager welcome events
2. Update GameContext to load story events on game start
3. Remove hardcoded message sending from Phase 1 code
4. Test: Verify Phase 1 flow unchanged
5. Benefit: Future Phase 1 changes = edit JSON, not code

**Phase 2 Phase 1 Integration:**
- Phase 1 events load first (welcome messages)
- Phase 2 events load after (Mission Board intro)
- Events chain naturally via trigger system
- Manager welcome → (20s delay) → Mission Board license

### Trigger Event System

**Core Game Trigger Events:**

**Phase 1 Events:**
- `gameStarted` - New game begins
- `desktopLoaded` - Desktop first appears
- `chequeDeposited` - Player deposits welcome bonus
- `messageRead` - Specific message opened
- `timePassed` - X minutes/hours of in-game time elapsed

**Phase 2 Events:**
- `missionBoardInstalled` - Mission Board app installed
- `missionAccepted` - Player accepts mission
- `missionObjectiveComplete` - Specific objective completed
- `missionComplete` - Mission finished (success/failure)
- `softwareInstalled` - Specific software installed
- `networkConnected` - Connected to network
- `networkDisconnected` - Disconnected from network
- `fileSystemAccessed` - File Manager connected to file system
- `fileOperationComplete` - Copy/repair/delete operation finished
- `reputationChanged` - Reputation tier changed
- `creditsChanged` - Credits crossed threshold
- `bankruptcyWarning` - Bankruptcy countdown started

**Trigger Conditions:**

```javascript
// Example trigger definition
{
  "type": "timeSinceEvent",
  "event": "chequeDeposited",
  "delay": 20000  // 20 seconds
}

{
  "type": "objectiveComplete",
  "missionId": "tutorial-part-1",
  "objectiveId": "obj-4"
}

{
  "type": "compound",
  "conditions": [
    {"event": "softwareInstalled", "software": "mission-board"},
    {"event": "timePassed", "duration": 5000}
  ],
  "operator": "AND"
}
```

### Story Mission Manager (Code Architecture)

**Core Components:**

**1. StoryMissionRegistry:**
- Loads all story mission definitions from data files
- Registers missions with trigger system
- Maintains mission state

**2. TriggerEventBus:**
- Core game emits trigger events
- Story missions subscribe to relevant events
- Decoupled from core game logic

**3. MissionObjectiveTracker:**
- Monitors objective completion conditions
- Updates mission state
- Emits objective complete events

**4. ScriptedEventExecutor:**
- Executes scripted events (sabotage, forced disconnects, etc.)
- Handles visual effects and timing
- Prevents player interaction during scripted sequences

**File Structure:**
```
src/
├── core/
│   ├── gameContext.jsx         (Core game state)
│   ├── triggerEventBus.js      (Event system)
│   └── ...
├── missions/
│   ├── StoryMissionManager.js  (Mission orchestration)
│   ├── ObjectiveTracker.js     (Objective monitoring)
│   ├── ScriptedEventExecutor.js (Event execution)
│   └── data/
│       ├── tutorial-part-1.json
│       ├── tutorial-part-2.json
│       └── post-tutorial/
│           ├── file-backup-01.json
│           ├── file-repair-01.json
│           └── ...
├── components/
│   └── apps/
│       └── MissionBoard.jsx    (UI only, reads from StoryMissionManager)
└── tests/
    ├── core/
    │   └── triggerEventBus.test.js
    ├── missions/
    │   ├── StoryMissionManager.test.js
    │   └── ObjectiveTracker.test.js
    └── e2e/
        └── tutorial-missions.spec.js (Tests full flow, not individual events)
```

### Benefits

**Separation of Concerns:**
- Core game: Gameplay mechanics, UI, state management
- Story missions: Mission definitions, objectives, scripted events
- Clear boundaries between systems

**Testability:**
- Unit test: Trigger event bus (does event fire correctly?)
- Unit test: Objective tracker (does completion detection work?)
- Unit test: Scripted event executor (does sabotage execute correctly?)
- Integration test: Story mission manager (do triggers activate missions?)
- E2E test: Full tutorial flow (player experience)

**Maintainability:**
- Add new missions: Create new JSON file, no code changes
- Modify mission: Edit JSON, no code changes
- Fix bug in core: Story missions unaffected
- Fix bug in story: Core game unaffected

**Future Expansion:**
- Easy to add more tutorial missions
- Easy to create mission editor tool (Phase 4+)
- Community mods possible (custom mission JSON files)

---

## Debug System (Architecture)

**Purpose:** Quickly set game state to specific conditions for testing advanced features

**Access:**
- Development mode only (not in production build)
- Keyboard shortcut: `Ctrl+Shift+D` (opens debug panel)
- URL parameter: `?debug=true` enables debug mode
- Environment variable: `VITE_DEBUG_MODE=true`

### Debug Panel UI

**Debug Panel Location:**
- Overlay on desktop (similar to pause overlay)
- Semi-transparent dark background
- Panel in center with tabs

**Tab Structure:**
1. **Game State** - Set credits, time, reputation
2. **Missions** - Trigger missions, set objectives
3. **Software** - Install/uninstall instantly
4. **Networks** - Add connections, simulate events
5. **Scenarios** - Pre-configured game states

### Debug Features

**Tab 1: Game State**

```
┌─ GAME STATE ─────────────────────────┐
│                                        │
│ Credits:  [-8000    ] [Set]           │
│ Reputation: [3 - Accident Prone ▼] [Set] │
│                                        │
│ Time:                                  │
│   Date: [25/03/2020] [Set]            │
│   Time: [14:30:00] [Set]              │
│   Speed: [1x] [10x]                   │
│                                        │
│ Game Status:                           │
│   [x] Paused                           │
│   [ ] Bankruptcy Warning Active        │
│   [ ] Reputation Warning Active        │
│                                        │
│ [Reset to Start] [Apply Changes]      │
└────────────────────────────────────────┘
```

**Tab 2: Missions**

```
┌─ MISSIONS ────────────────────────────┐
│                                        │
│ Active Mission: [tutorial-part-1 ▼]   │
│   Current Objective: [obj-3 ▼]        │
│   [Complete Current Objective]         │
│   [Complete Mission (Success)]         │
│   [Fail Mission]                       │
│                                        │
│ Available Missions:                    │
│   [ ] tutorial-part-1                  │
│   [x] tutorial-part-2                  │
│   [ ] file-backup-01                   │
│   [Add Selected to Mission Board]      │
│                                        │
│ Completed Missions:                    │
│   [Clear All] [Import List...]         │
│                                        │
│ [Trigger Scripted Event...]            │
└────────────────────────────────────────┘
```

**Tab 3: Software**

```
┌─ SOFTWARE ────────────────────────────┐
│                                        │
│ Installed Software:                    │
│   [x] OSNet                            │
│   [x] Portal                           │
│   [ ] Mission Board                    │
│   [ ] VPN Client                       │
│   [ ] Network Scanner                  │
│   [ ] File Manager                     │
│   [ ] Network Address Register         │
│                                        │
│ [Install Selected Instantly]           │
│ [Uninstall Selected]                   │
│                                        │
│ Quick Presets:                         │
│   [Tutorial Start State]               │
│   [Post-Tutorial State]                │
│   [Mid-Game State]                     │
│                                        │
│ Storage: 13.7 GB / 90 GB               │
└────────────────────────────────────────┘
```

**Tab 4: Networks**

```
┌─ NETWORKS ────────────────────────────┐
│                                        │
│ Network Address Register:              │
│   [ ] ClientA-Corporate                │
│   [ ] ClientB-DataCenter               │
│   [ ] TestNetwork-Alpha                │
│   [Add Selected to NAR]                │
│                                        │
│ Active Connections:                    │
│   [x] ClientA-Corporate                │
│   [ ] ClientB-DataCenter               │
│   [Connect Selected] [Disconnect All]  │
│                                        │
│ Simulate Events:                       │
│   [Force Disconnect (sabotage)]        │
│   [Network Discovery (show hidden)]    │
│                                        │
└────────────────────────────────────────┘
```

**Tab 5: Scenarios (Pre-configured States)**

```
┌─ SCENARIOS ───────────────────────────┐
│                                        │
│ Quick Start Scenarios:                 │
│                                        │
│ [Fresh Start]                          │
│   - 1,000 credits, Superb rep          │
│   - No missions, no software           │
│                                        │
│ [Tutorial Part 1 Start]                │
│   - Mission Board installed            │
│   - Tutorial mission available         │
│   - Ready to accept mission            │
│                                        │
│ [Tutorial Part 1 Failed]               │
│   - -9,000 credits, Accident Prone     │
│   - Tutorial Part 2 available          │
│   - Interest accumulating              │
│                                        │
│ [Post-Tutorial (In Debt)]              │
│   - -8,000 credits, Accident Prone     │
│   - All tutorial software installed    │
│   - 5 missions available               │
│                                        │
│ [Mid-Game (Recovering)]                │
│   - -2,000 credits, Can Work With Help │
│   - 10 missions completed              │
│   - Working toward breaking even       │
│                                        │
│ [Out of Debt]                          │
│   - +5,000 credits, Reliable           │
│   - Tutorial complete, good reputation │
│   - Ready for advanced missions        │
│                                        │
│ [High Performer]                       │
│   - +50,000 credits, Ace Agent         │
│   - All software, advanced missions    │
│                                        │
│ [Near Bankruptcy]                      │
│   - -10,500 credits, countdown active  │
│   - 2 minutes remaining                │
│   - Test bankruptcy system             │
│                                        │
│ [Near Termination]                     │
│   - Should Be Let Go (Tier 1)          │
│   - 5 minutes remaining                │
│   - Test reputation game over          │
│                                        │
└────────────────────────────────────────┘
```

### Trigger Event System Implementation

**Core Game Emits Events:**

```javascript
// In GameContext.jsx or relevant component
const emitTriggerEvent = (eventType, eventData) => {
  triggerEventBus.emit(eventType, {
    timestamp: currentTime,
    gameState: getGameState(),
    ...eventData
  });
};

// Examples throughout core game:
// When mission accepted
emitTriggerEvent('missionAccepted', { missionId: mission.id });

// When objective completes
emitTriggerEvent('missionObjectiveComplete', {
  missionId: activeMission.id,
  objectiveId: objective.id
});

// When software installed
emitTriggerEvent('softwareInstalled', {
  softwareId: software.id,
  softwareName: software.name
});
```

**Story Missions Subscribe:**

```javascript
// In StoryMissionManager.js
class StoryMissionManager {
  loadStoryMission(missionDef) {
    // Subscribe to trigger events
    if (missionDef.triggers.start.type === 'timeSinceEvent') {
      triggerEventBus.on(missionDef.triggers.start.event, (data) => {
        setTimeout(() => {
          this.activateMission(missionDef.missionId);
        }, missionDef.triggers.start.delay);
      });
    }

    // Subscribe to scripted event triggers
    missionDef.scriptedEvents.forEach(event => {
      if (event.trigger.type === 'afterObjectiveComplete') {
        triggerEventBus.on('missionObjectiveComplete', (data) => {
          if (data.objectiveId === event.trigger.objectiveId) {
            setTimeout(() => {
              this.executeScriptedEvent(event);
            }, event.trigger.delay);
          }
        });
      }
    });
  }
}
```

### Testing Strategy

**Unit Tests (Fast, Isolated):**
- **TriggerEventBus:** Does event emit/subscribe work?
- **ObjectiveTracker:** Does completion detection work for each objective type?
- **ScriptedEventExecutor:** Does sabotage event execute correctly?
- **Outcome:** Core event system validated without running full stories

**Integration Tests (Moderate):**
- **StoryMissionManager:** Does trigger activate mission?
- **Mission Flow:** Do objectives progress correctly?
- **Outcome:** Mission system works without testing specific story content

**E2E Tests (Slow, Full Experience):**
- **Tutorial Part 1:** Full player flow from start to sabotage
- **Tutorial Part 2:** Full recovery mission flow
- **Outcome:** Player experience validated

**Benefits:**
- Can test trigger system in milliseconds (unit tests)
- Don't need to test every story mission in E2E
- Add new missions without new E2E tests (just integration tests)
- Debug system enables manual testing of any scenario instantly

### Phase 2 Implementation Priority

**Priority 1: Core Systems**
- Trigger event bus
- Objective tracker
- Story mission manager

**Priority 2: Tutorial Missions**
- Tutorial Part 1 & 2 story definitions
- Scripted event executor (sabotage)

**Priority 3: Post-Tutorial Missions**
- Simple mission templates (file backup, repair)
- Procedural mission generation (optional)

---

## Debug System (Detailed)

**Purpose:** Rapidly set game state for testing, development, and debugging

**Development Only:**
- Only available in development builds (`NODE_ENV=development`)
- Removed automatically in production build
- Safe to use - doesn't affect save files unless explicitly saved

### Debug Mode Activation

**Method 1: Keyboard Shortcut**
- Press `Ctrl+Shift+D` (Windows/Linux) or `Cmd+Shift+D` (Mac)
- Debug panel overlays desktop
- Game automatically pauses when debug panel open

**Method 2: URL Parameter**
- Launch with `?debug=true`
- Debug icon appears in top bar (developer tools icon)
- Click icon to open debug panel

**Method 3: Environment Variable**
- Set `VITE_DEBUG_MODE=true` in `.env.local`
- Debug always available during development

### Debug Commands

**Instant State Changes:**

```javascript
// Quick state setters
setCredits(-8000);                    // Set to specific amount
setReputation(3);                     // Set to tier 3 (Accident Prone)
setTime('25/03/2020', '14:30:00');   // Set specific date/time
skipTime(60);                         // Skip 60 minutes forward

// Software management
installSoftware(['mission-board', 'vpn-client', 'file-manager']);  // Instant install
uninstallSoftware(['vpn-client']);                                  // Instant uninstall

// Network management
addNetworkToNAR('clienta-corporate');   // Add to Network Address Register
connectToNetwork('clienta-corporate');   // Instant connection
disconnectAll();                         // Disconnect all networks

// Mission management
setActiveMission('tutorial-part-1');     // Set specific mission active
completeObjective('obj-3');              // Mark objective complete
failMission('Custom failure reason');    // Force mission failure

// Trigger events manually
triggerEvent('missionObjectiveComplete', { objectiveId: 'obj-4' });
```

**Scenario Presets:**

Each scenario is one click to complex game state:

```javascript
const scenarios = {
  freshStart: {
    credits: 1000,
    reputation: 9,
    software: ['osnet', 'portal', 'mail', 'banking'],
    missions: [],
    time: '25/03/2020 09:00:00'
  },

  tutorialPart1Failed: {
    credits: -9000,
    reputation: 3,
    software: ['osnet', 'portal', 'mail', 'banking', 'mission-board',
               'vpn-client', 'network-scanner', 'file-manager', 'nar'],
    missions: {
      completed: ['tutorial-part-1'],
      available: ['tutorial-part-2']
    },
    time: '25/03/2020 10:30:00'
  },

  postTutorial: {
    credits: -8000,
    reputation: 3,
    software: ['osnet', 'portal', 'mail', 'banking', 'mission-board',
               'vpn-client', 'network-scanner', 'file-manager', 'nar'],
    missions: {
      completed: ['tutorial-part-1', 'tutorial-part-2'],
      available: ['file-backup-01', 'file-backup-02', 'file-repair-01']
    },
    time: '25/03/2020 12:00:00'
  },

  nearBankruptcy: {
    credits: -10500,
    reputation: 3,
    bankruptcyCountdown: 120,  // 2 minutes remaining
    software: ['osnet', 'portal', 'mail', 'banking', 'mission-board',
               'vpn-client', 'network-scanner', 'file-manager', 'nar'],
    missions: { available: ['file-backup-01'] },
    time: '25/03/2020 15:00:00'
  },

  nearTermination: {
    credits: 500,
    reputation: 1,  // Should be let go
    reputationCountdown: 300,  // 5 minutes remaining
    software: ['osnet', 'portal', 'mail', 'banking', 'mission-board',
               'vpn-client', 'network-scanner', 'file-manager', 'nar'],
    missions: { available: ['file-backup-01'] },
    time: '26/03/2020 09:00:00'
  },

  highPerformer: {
    credits: 50000,
    reputation: 10,  // Ace Agent
    software: ['osnet', 'portal', 'mail', 'banking', 'mission-board',
               'vpn-client', 'network-scanner', 'file-manager', 'nar'],
    missions: {
      completed: Array(25).fill(null).map((_, i) => `mission-${i}`),
      available: ['elite-contract-01']
    },
    time: '10/04/2020 16:00:00'
  }
};
```

### Debug System Features

**State Inspection:**
- View current game state (JSON export)
- View mission state
- View trigger event history
- View recent game events

**Time Manipulation:**
- Skip forward/backward in time
- Set specific date/time
- Pause/unpause time
- Set time speed

**Mission Control:**
- Start any mission instantly
- Complete objectives individually
- Trigger scripted events manually
- Test failure conditions
- Reset mission state

**Financial Controls:**
- Set credits to any value (positive or negative)
- Trigger bankruptcy countdown manually
- Test interest calculation
- Simulate transactions

**Reputation Controls:**
- Set to any tier (1-11)
- Trigger warnings/countdowns
- Test mission gating
- Test payout scaling

**Network Simulation:**
- Add any network to NAR instantly
- Connect/disconnect instantly
- Simulate forced disconnections
- Test bandwidth sharing

**Software Management:**
- Install any software instantly (bypass download)
- Uninstall software
- Test storage limits
- Simulate full SSD

### Automated Testing Integration

**Test Helpers (Vitest/Jest):**

```javascript
// In test setup files
import { debugSetGameState } from '@/debug/debugSystem';

describe('Mission System - Post Tutorial', () => {
  beforeEach(() => {
    // Use debug system to quickly set up test state
    debugSetGameState(scenarios.postTutorial);
  });

  it('should allow accepting file backup mission', () => {
    const mission = getMissionById('file-backup-01');
    expect(mission.available).toBe(true);
    expect(canAcceptMission(mission)).toBe(true);
  });
});

describe('Bankruptcy System', () => {
  it('should trigger countdown at -10k', () => {
    debugSetGameState({ credits: -10001 });
    advanceTime(60); // 1 minute
    expect(bankruptcyCountdownActive()).toBe(true);
    expect(bankruptcyTimeRemaining()).toBe(4 * 60); // 4 minutes left
  });
});
```

**E2E Test Helpers (Playwright):**

```javascript
// In Playwright tests
test('Tutorial Part 2 flow', async ({ page }) => {
  // Use debug to skip to tutorial Part 1 failed state
  await page.goto('/?debug=true');
  await page.evaluate(() => {
    window.debugSetScenario('tutorialPart1Failed');
  });

  // Now test Part 2 flow
  await page.click('[data-testid="mission-board"]');
  await page.click('[data-testid="accept-mission-tutorial-part-2"]');
  // ... rest of test
});
```

### Debug System Architecture

**Code Structure:**

```
src/debug/
├── debugSystem.js           (Main debug controller)
├── debugPanel.jsx           (UI component)
├── scenarios.js             (Pre-configured states)
├── stateManipulation.js     (State setters)
└── eventSimulator.js        (Trigger event simulation)
```

**Integration Points:**
- GameContext exposes debug methods (dev mode only)
- TriggerEventBus has debug mode (log all events)
- StoryMissionManager has debug controls (skip to objectives)
- All debug code removed in production build (Vite env checks)

### Benefits for Development

**Faster Development:**
- Test advanced features without playing through tutorial
- Test edge cases (bankruptcy, termination) instantly
- Iterate on UI without replaying game

**Better Testing:**
- Automated tests run faster (no waiting for downloads/time)
- Test specific conditions easily
- Reproduce bugs reliably

**Quality Assurance:**
- Manually verify all game states
- Test all scenarios quickly
- Validate mission system thoroughly

---

## Phase 2 Completion Criteria (Updated)

Phase 2 is complete when:

### Core Systems
- ✓ All Phase 2 game systems implemented (reputation, bankruptcy, etc.)
- ✓ **Story Mission System implemented** (trigger events, objective tracking, scripted events)
- ✓ **Debug System implemented** (state manipulation, scenarios, testing helpers)
- ✓ Software purchasing and installation works
- ✓ Storage system tracks SSD usage
- ✓ Bandwidth sharing works correctly

### Testing
- ✓ Trigger event system has 90%+ unit test coverage
- ✓ Story mission manager has 90%+ integration test coverage
- ✓ Tutorial missions tested E2E
- ✓ Debug system enables rapid automated testing
- ✓ All scenarios loadable and functional

---

## Implementation Notes

**Story Mission System:**
- Implement trigger system FIRST (foundation for all missions)
- Tutorial missions as first story mission implementations
- Keep mission definitions in separate data files
- Design for future mission editor tool

**Debug System:**
- Build alongside features (not at the end)
- Essential for testing bankruptcy/reputation edge cases
- Makes manual QA much faster
- Helps with demo/presentation scenarios

---

## Reputation System (Detailed)

**Purpose:** Track player performance as a SourceNet agent, similar to job title/seniority progression

**Starting Reputation:** Superb (Tier 9)
- Manager's welcome message references interview performance
- "You really impressed us with your skills and dedication"
- High starting reputation builds player confidence before tutorial failure

### Reputation Tiers (11 Levels)

| Tier | Name | Color | Description | Client Types | Payout Multiplier |
|------|------|-------|-------------|--------------|-------------------|
| 1 | Should be let go | Dark Red | **FINAL WARNING** - 10 mins to complete mission or FIRED | Only non-critical clients (Libraries, Museums) | 0.5x (50% penalty) |
| 2 | On performance plan | Red | **WARNING** - One more failure = Tier 1 | Small businesses, non-profits | 0.7x (30% penalty) |
| 3 | Accident prone | Red/Orange | Recent failures, needs practice | Small clients, some medium businesses | 0.85x (15% penalty) |
| 4 | Can work with help | Orange | Developing skills, improving | Medium businesses, retail chains | 1.0x (standard pay) |
| 5 | OK | Yellow | Meets minimum expectations | Most medium businesses | 1.0x |
| 6 | Semi-competent | Light Green | Reliable for routine tasks | Medium + some large businesses | 1.1x (10% bonus) |
| 7 | Reliable | Green | Consistently good performance | Large businesses, some corporations | 1.2x (20% bonus) |
| 8 | High achiever | Bright Green | Exceeds expectations regularly | Corporations, some financial institutions | 1.3x (30% bonus) |
| 9 | Superb | Blue-Green | Excellent track record | All corporations, banks, government | 1.5x (50% bonus) |
| 10 | Ace agent | Blue | Elite performer | All clients + special contracts | 1.7x (70% bonus) |
| 11 | Star employee | Gold | Top tier SourceNet agent | All clients + exclusive elite contracts | 2.0x (100% bonus) |

### Reputation Changes

**Tutorial Part 1 Failure:**
- Drop from Superb (9) → Accident Prone (3)
- Represents significant setback (-6 tiers)
- Manager's angry message reinforces reputation hit
- Creates motivation to rebuild reputation

**Post-Tutorial Mission Success:**
- +1 tier for successful mission completion (diminishing returns at higher tiers)
- Faster mission completion (tier bonuses) may grant extra reputation
- Consecutive successes may grant bonus reputation

**Post-Tutorial Mission Failure:**
- -1 to -3 tiers depending on failure severity
- Financial penalties (credit loss) accompany reputation loss
- Cannot retry failed missions (permanent record)

**Reputation Recovery:**
- Player must complete missions successfully to rebuild
- Takes approximately 6-8 successful missions to return to Superb from Accident Prone
- Demonstrates player learning and improvement

### Warning System & Game Over

**Tier 2: "On Performance Plan" - Warning Triggered**

When reputation drops to Tier 2, immediate warning message from SourceNet HR:

```
From: SourceNet Human Resources (SNET-HQ0-000-001)
Subject: URGENT - Performance Plan Required

[username],

Your recent mission failures have resulted in you being placed on a performance
improvement plan.

Current Reputation: On Performance Plan (Tier 2)

This is a formal warning. If your reputation drops to "Should be let go" (Tier 1),
you will have ONE FINAL CHANCE to prove yourself. Failure to complete a mission
successfully within 10 minutes will result in termination of your contract with
SourceNet.

We expect immediate improvement in your performance.

- SourceNet Human Resources
```

**Tier 1: "Should be Let Go" - Final Warning**

When reputation drops to Tier 1:

1. **Immediate Effects:**
   - Top bar reputation icon turns dark red with warning animation
   - 10-minute countdown timer starts
   - Can only accept missions from non-critical clients (Libraries, Museums)
   - Payout penalty: 50% of normal rate

2. **Warning Message from SourceNet:**
```
From: SourceNet Human Resources (SNET-HQ0-000-001)
Subject: FINAL WARNING - Termination Imminent

[username],

Your reputation has reached "Should be let go" (Tier 1).

You have 10 MINUTES to successfully complete a mission or your contract will
be TERMINATED.

Complete any available mission successfully within the next 10 minutes to avoid
termination. If you fail this mission OR the timer expires, you will be let go.

This is your final chance.

- SourceNet Human Resources
```

3. **10-Minute Timer:**
   - Countdown visible in top bar (next to reputation)
   - Audio chime every minute
   - At 1 minute remaining: Audio chime every 10 seconds
   - At 10 seconds remaining: Audio chime every second

4. **Mission Success Before Timer:**
   - Reputation increases to Tier 2 ("On Performance Plan")
   - Timer cancelled
   - Player survives but still on thin ice

5. **Timer Expires OR Mission Fails:**
   - **GAME OVER**
   - Screen fades to black
   - Message: "SourceNet has terminated your contract due to poor performance. You are no longer able to work as an agent."
   - Options: Load previous save OR Return to game login screen

### Mission Gating by Reputation

**Client Type Gating:**
- **Low Reputation (Tiers 1-3):** Libraries, Museums, Small Businesses
- **Medium Reputation (Tiers 4-6):** Medium Businesses, Retail Chains
- **High Reputation (Tiers 7-9):** Corporations, Banks, Government
- **Elite Reputation (Tiers 10-11):** Exclusive special contracts

**Payout Scaling:**
- Base mission payout × Reputation multiplier
- Example: 1,000 credit mission
  - Tier 1: 500 credits (0.5x)
  - Tier 5: 1,000 credits (1.0x)
  - Tier 9: 1,500 credits (1.5x)
  - Tier 11: 2,000 credits (2.0x)

**Mission Board Display:**
- **Available Missions:** Missions within your reputation range (normal display)
- **Out of Range (Too Low Rep):** Greyed out, shows required tier
  - "Requires: Reliable (Tier 7) or higher"
  - Shows potential payout (motivates improvement)
  - Cannot accept until reputation increases
- **Out of Range (Too High Rep):** Hidden (don't show low-tier missions to elite agents)

### UI Display

**Top Bar Reputation Indicator:**
- Icon: Badge/Star
- Color: Matches tier color scale
- Badge number: Tier number (1-11)
- Hover tooltip: "[Tier Name] - [Description]"
- Click: Opens reputation details modal

**Reputation Details Modal:**
- Current tier name and description
- Visual progress bar to next tier
- Recent reputation changes (mission history)
- Next tier requirements
- Mission access summary

---

## Bankruptcy System (Detailed)

**Purpose:** Create financial consequences and urgency, especially during tutorial recovery

### Overdraft Mechanics

**Overdraft Allowed:** YES
- Bank account can go negative
- No immediate consequences for being overdrawn
- Interest begins accruing immediately

**Interest Calculation:**
- Rate: 1% per minute of in-game time
- Applies to negative balance only
- Example at -9,000 credits:
  - 1x time speed: -90 credits per minute
  - 10x time speed: -900 credits per minute (time flows 10x faster)
- Interest compounds (debt grows exponentially if unpaid)
- Pauses when game is paused

**Tutorial Impact:**
- Player starts with 1,000 credits
- Part 1 failure: -10,000 penalty → -9,000 balance
- Part 2 success: +1,000 → -8,000 balance
- Player deeply in debt, interest accumulating
- Creates real urgency to complete missions

### Bankruptcy Trigger

**Threshold:** Overdrawn by MORE than 10,000 credits for 5 consecutive minutes

**Example Scenarios:**
- -10,001 credits for 5 minutes = Bankruptcy triggered
- -10,000 credits = Safe (exactly at limit)
- -9,999 credits = Safe (under limit)

**5-Minute Countdown:**
- Starts when balance drops below -10,000
- Countdown timer appears in top bar (red flashing banner)
- Bank sends urgent warning message
- If balance rises above -10,000, countdown resets/cancels
- Player can escape bankruptcy by completing mission during countdown

**Tutorial Part 1 Aftermath:**
- Player at -9,000 (1,000 under bankruptcy threshold)
- Buffer gives player time to complete Part 2
- Interest slowly eating away at buffer
- Part 2 must be completed before hitting -10,000

### Warning System

**First Overdraft (Any Amount):**
- Bank message: "Your account is overdrawn. Interest of 1% per minute will be charged."
- Informational tone, explains mechanics

**Approaching Bankruptcy (-8,000 to -9,999):**
- Bank message: "Warning: You are approaching bankruptcy threshold."
- Cautions player about -10,000 limit

**Bankruptcy Countdown (-10,001 or worse):**
- Red flashing banner in top bar
- Message: "BANKRUPTCY WARNING: [X:XX] remaining"
- Countdown shows minutes:seconds
- Bank message: "URGENT: Financial authorities will seize your assets in [X] minutes if balance does not improve."
- Manager message: "I warned you about bankruptcy. SourceNet cannot protect you. Complete missions IMMEDIATELY."

**Audio Warnings During Countdown:**
- Every minute: Audio warning chime
- At 10 seconds remaining: **Audio chime EVERY SECOND** (intense final warning)
- Updated countdown message with increasing urgency

### Bankruptcy Consequences

**Game Over:**
- When countdown reaches 0:00
- Screen fades to black
- Message: "SourceNet has been notified of your bankruptcy. The bank has worked with SourceNet to seize your assets by order of financial authorities. You are no longer able to work as a SourceNet agent."
- Options:
  - Load previous save
  - Return to game login screen (start new game)
- Save file marked as "BANKRUPT" (cannot continue)

**Avoiding Bankruptcy:**
- Complete missions for credits
- Manager's tutorial message: "Work until you're back in the black"
- Post-tutorial missions pay 800-1,500 credits each
- Need 8-10 missions to fully recover from tutorial debt

### Strategic Implications

**Time Speed Trade-off:**
- 10x speed completes missions faster BUT interest accumulates 10x faster
- Players must balance speed vs. debt growth
- Missions at 10x may be harder (password cracking progresses faster, less thinking time)
- Creates tension: Fast missions vs. careful missions

**Mission Selection While In Debt:**
- Cannot afford to fail (no retries)
- Lower-paying but safer missions vs. higher-paying risky missions
- Interest pressure encourages risk-taking (need credits fast)
- Tutorial teaches consequence of failure before high stakes

---

## Mission System Design

### Mission Board Application

**Application Name:** SourceNet Mission Board

**Purpose:** View and accept ethical hacking contracts from SourceNet

**Interface Tabs:**
1. **Available Missions** - Missions you can accept
2. **Active Mission** - Your current mission (only 1 at a time)
3. **Completed Missions** - History of finished missions

**Mission Display (Available Missions Tab):**
- Mission Title
- Client Name (anonymized: "Client A", "Client B", etc.)
- Difficulty Rating (Beginner, Easy, Medium, Hard, Expert)
- Payout Amount (in credits)
- Requirements (software/hardware needed)
- Brief Description (2-3 sentences)
- "Accept Mission" button

**Mission Requirements:**
- Some missions require specific software (e.g., "Requires: SourceNet VPN Client, Network Scanner")
- If player doesn't own required software, button shows "Purchase Requirements" instead
- Clicking "Purchase Requirements" opens Portal to the needed software
- Cannot accept mission without meeting all requirements

**Active Mission Tab:**
- Shows currently accepted mission
- Displays mission briefing (full details)
- Shows objective checklist (e.g., "1. Connect to VPN", "2. Scan network", "3. Find credentials")
- Shows progress on each objective
- Shows elapsed time since mission accepted (for tiered payment calculation)
- "Abandon Mission" button (forfeits mission, can accept another)
- "Complete Mission" button (appears when all objectives met)

**Tiered Payment System:**
- Missions track completion time from acceptance to submission
- Three payment tiers based on speed:
  - **Standard:** Base payout (complete within generous time window)
  - **Fast:** +25% bonus (complete faster than standard, requires decent hardware)
  - **Exceptional:** +50% bonus (complete very quickly, requires upgraded hardware)
- Time thresholds defined per mission difficulty
- Tutorial mission has fixed payout (no tiers for learning mission)
- Better CPU = faster password cracking = faster completion = higher tier
- Timer pauses when game is paused

**Completed Missions Tab:**
- List of finished missions
- Shows: Title, Client, Payout (with tier badge), Completion Date/Time, Completion Speed
- Click mission to view full briefing and what you did

### Mission Types (Phase 2)

**1. Tutorial Mission - "First Assignment"**
- **Difficulty:** Beginner
- **Payout:** 500 credits
- **Requirements:** None (uses pre-installed software)
- **Objective:** Learn the basics
- **Steps:**
  1. Read briefing from Manager (arrives via SNet Mail)
  2. Purchase and install SourceNet VPN Client
  3. Connect to SourceNet test network via VPN
  4. Run Network Scanner to find test target
  5. Use Password Cracker on test target
  6. Submit results

**2. Network Reconnaissance**
- **Difficulty:** Easy
- **Payout:** 800-1,200 credits
- **Requirements:** SourceNet VPN Client, Network Scanner
- **Objective:** Map client's network and identify vulnerabilities
- **Steps:**
  1. Connect to client network via VPN
  2. Scan network for active hosts
  3. Identify open ports on target systems
  4. Document findings
  5. Submit report

**3. Credential Recovery**
- **Difficulty:** Medium
- **Payout:** 1,500-2,500 credits
- **Requirements:** SourceNet VPN Client, Network Scanner, Password Cracker
- **Objective:** Recover lost credentials for client
- **Steps:**
  1. Connect to client network
  2. Locate authentication server
  3. Extract password hash
  4. Crack password using Password Cracker tool
  5. Submit credentials

**4. Security Audit**
- **Difficulty:** Medium
- **Payout:** 2,000-3,000 credits
- **Requirements:** SourceNet VPN Client, Network Scanner, Vulnerability Scanner
- **Objective:** Comprehensive security assessment
- **Steps:**
  1. Connect to client network
  2. Scan all systems
  3. Run vulnerability scanner on each system
  4. Document security weaknesses
  5. Submit detailed report

**5. Data Extraction**
- **Difficulty:** Hard
- **Payout:** 3,500-5,000 credits
- **Requirements:** SourceNet VPN Client, Network Scanner, File Extractor, Encryption Breaker
- **Objective:** Retrieve specific files from secure server
- **Steps:**
  1. Connect to target network
  2. Locate file server
  3. Bypass access controls
  4. Decrypt protected files
  5. Extract and submit data

### Mission Availability

**Starting State:**
- Mission Board license sent 20 seconds after Phase 1 manager welcome
- Player must install Mission Board before tutorial begins
- Tutorial missions appear after Mission Board installed
- Additional mission types added iteratively during Phase 2 development

**Mission Cooldowns (After Tutorial):**
- **Easy missions:** No cooldown - can chain immediately after completion
- **Medium missions:** 10-15 game minutes cooldown before next Medium mission available
- **Hard missions:** 30-45 game minutes cooldown before next Hard mission available
- **Cooldown Purpose:** Prevents farming high-payout missions, encourages varied gameplay

**Mission Refresh:**
- Completing a mission may add new missions to board
- Abandoning a mission returns it to available pool after 1 game day

### Mission Failure System

**Simple Failure Conditions (Phase 2):**
- **Retry Allowed:** Player can immediately retry failed missions (no penalty)
- **Failure Triggers:**
  - Wrong password after 3 attempts (Password Cracker)
  - Disconnecting from VPN during critical mission step
  - (Additional failure conditions added with each mission type)
- **No Consequences in Phase 2:** Failures don't affect reputation, credits, or availability
- **Learning Tool:** Failures guide player to correct approach

---

## Purchasing System Design

### Portal Updates

**OSNet Software/Hardware Portal - Phase 2 Changes:**

**Hardware Category:**
- Each item shows: Name, Specs, Price, "Installed" badge (if owned)
- New: "Purchase" button appears on items not owned
- Clicking "Purchase" opens confirmation modal

**Software Category:**
- Now shows multiple software applications
- **Each item ALWAYS shows:**
  - Name
  - Description
  - **Price** (displayed for ALL software, even free-licensed ones)
  - Storage requirement (e.g., "Requires 500 MB")
  - Requirements (minimum hardware specs if applicable)
  - **Status badges:**
    - "Installed" - Software currently installed
    - "Licensed" - You own a free license (price shown but greyed out)
    - "Installing..." - Currently downloading/installing
- **Purchase button:**
  - Shows "Purchase" for items you don't own
  - Shows "Install" for items with "Licensed" status (no cost)
  - Shows "Installed" for already installed items (greyed out)

**Example Portal Display:**
```
SourceNet VPN Client
Secure connection to private networks
Price: $500 | Storage: 500 MB | Licensed
[Install]
```

```
Network Scanner
Scan networks for machines and file systems
Price: $300 | Storage: 300 MB | Licensed
[Install]
```

```
Advanced Security Suite
Professional security analysis tools
Price: $2,500 | Storage: 1.2 GB
[Purchase]
```

**Purchase Confirmation Modal:**
```
Purchase [Item Name]?

Price: [X] credits
Your Balance: [Y] credits
After Purchase: [Y-X] credits

[Confirm Purchase]  [Cancel]
```

**Insufficient Funds Modal:**
```
Insufficient Credits

[Item Name] costs [X] credits.
You have [Y] credits.
You need [X-Y] more credits.

[OK]
```

**Purchase Success:**
- Credits deducted immediately
- Item moved to installation queue
- Portal updates to show "Installing..." status on item
- Banking notification appears (transaction recorded)

### Installation System

**Download Process:**

**Installation Queue (New UI Element):**
- Small widget in bottom-right of desktop (near minimized window bar)
- Shows current downloads/installations
- Format: "[Item Name] - [Progress]%"
- Can click to view details modal

**Download Speed Calculation:**
- Based on player's installed Network Adapter
- 250Mb/s adapter: 1MB per second of game time (at 1x speed, 10MB at 10x speed)
- 500Mb/s adapter: 2MB per second
- 1Gb/s adapter: 4MB per second
- 5Gb/s adapter: 20MB per second
- 10Gb/s adapter: 40MB per second

**Download Sizes:**

**Software Applications:**
- Small apps (50-100MB): VPN Client, Network Scanner, Password Cracker
- Medium apps (200-500MB): Vulnerability Scanner, File Extractor
- Large apps (500MB-1GB): Encryption Breaker, Advanced tools

**Hardware Drivers:**
- Small driver packages (20-50MB): Most hardware

**Installation Time:**
- Software: 5 seconds of game time after download
- Hardware: 10 seconds of game time after download, then requires reboot

**Hardware Installation - Reboot Requirement:**
- After hardware installation completes, notification appears:
  ```
  Hardware Installation Complete

  [Hardware Name] has been installed.
  A reboot is required to use this hardware.

  [Reboot Now]  [Reboot Later]
  ```
- If "Reboot Later": Hardware will not be active until next reboot
- If "Reboot Now": Immediate reboot sequence (7 seconds)
- Can install multiple hardware items before rebooting (batch reboot)

**Software Installation - No Reboot:**
- Software available immediately after installation
- Notification appears:
  ```
  Installation Complete

  [Software Name] is now available.

  [OK]
  ```
- Software appears in app launcher immediately

---

## New Applications

### 1. SourceNet VPN Client

**Application Name:** SourceNet VPN Client

**Purpose:** Secure connection to private networks for SourceNet mission work

**Acquisition:** FREE - Received as attachment in manager's first tutorial message
- Message attachment adds license to Portal account
- Player must go to Portal to download and install
- Portal shows "Licensed" instead of price
- Future Phase: Additional VPN clients for other networks (Phase 3+)

**Price in Portal:** $500 (but player receives free license)

**Interface:**

**Main View (Always Visible):**
- **Connected Networks List:** Shows all currently connected networks
  - Each entry: Network name, connection status, "Disconnect" button
  - If no connections: "No active connections"
- **New Connection Section:**
  - Network dropdown: "Select Network" (from Network Address Register)
  - "Connect" button (greyed out until network selected)
- **Connection Log:** Shows recent connection activity

**Network Selection:**
- Dropdown shows networks from Network Address Register
- Mission messages include network entry attachments (must be clicked to add to NAR)
- Only shows networks player has credentials for
- Format: "Client A - Network Alpha", "SourceNet Test Network"

**Opening VPN from Network Address Register:**
- Click network entry in NAR app → Opens VPN Client with that network pre-selected
- "Connect" button active immediately
- Quick connection workflow

**Connection Process:**
1. Receive mission message with network entry attachment
2. Click attachment to add to Network Address Register
3. Open VPN Client (or click network in NAR to open VPN with pre-selection)
4. Select network from dropdown (if not pre-selected)
5. Click "Connect"
6. Connection status shows "Connecting..." (2-5 seconds)
7. Network added to "Connected Networks List" in VPN Client
8. Network appears in top bar connection indicator (badge count increases)
9. Mission objectives can now progress

**Disconnecting:**
- Three ways to disconnect:
  1. Click "Disconnect" button in VPN Client connected networks list
  2. Click network in top bar connection indicator → "Disconnect" option
  3. VPN connection may be forcibly terminated by network administrator (mission event)
- Disconnection immediate
- Badge count in top bar decreases
- Network removed from connected list

**Multiple Connections:**
- Can be connected to multiple networks simultaneously
- Each network appears in connected networks list
- File Manager can access file systems on any connected network
- Network Scanner can scan any connected network

**Disconnected Actions:**
- Some mission objectives require specific VPN connection
- Attempting mission actions without VPN shows error:
  ```
  VPN Connection Required

  You must connect to [Network Name] via VPN to proceed.

  [Open VPN Client]  [Cancel]
  ```

### 2. Network Scanner

**Application Name:** Network Scanner

**Purpose:** Scan connected networks to discover machines and file systems

**Acquisition:** FREE - Received as attachment in manager's first tutorial message (along with VPN Client)

**Requirements:** Must be connected to at least one network (via VPN)

**Interface:**

**Main View:**
- **Connected Network dropdown:** Select which network to scan (shows all active connections)
- **Scan Type:** "Quick Scan" (finds machines only), "Deep Scan" (finds machines + file systems)
- "Start Scan" button
- Results panel (empty until scan runs)
- "Rescan" button (can scan multiple times)

**Scanning Process:**
1. Select connected network from dropdown
2. Choose scan type:
   - Quick Scan: 5 seconds, finds machines only
   - Deep Scan: 15 seconds, finds machines + file systems + services
3. Click "Start Scan"
4. Progress bar shows scan progress
5. Results populate as discovered

**Results Display:**
- List of discovered machines
- Each machine shows:
  - IP address
  - Hostname (if available)
  - File systems available (if deep scan)
  - Services running (if deep scan)
- Can click machine to see details
- Results persist until window closed

**Time-Based Discovery:**
- Some machines only discoverable at certain times/mission stages
- Scanning multiple times may reveal new machines
- Mission progression can unlock discoverability
- In-game time affects what's currently discoverable
- Tutorial example: Backup file system not discoverable until Tutorial Part 2 begins

**Mission Integration:**
- Most missions require scanning to find target machines
- File systems discovered here are used by File Manager app
- Results determine available targets for mission objectives

### 3. Network Address Register

**Application Name:** Network Address Register

**Purpose:** Manage network connections and credentials for mission networks

**Acquisition:** FREE - Received as attachment in manager's first tutorial message (along with VPN Client and Network Scanner)

**Interface:**

**Main View:**
- List of registered networks
- Each entry shows:
  - Network name
  - Network address/IP range
  - Credentials status (Authorized/Expired)
  - Connection status (Connected/Disconnected)
  - Date added
  - **"Connect" button** (opens VPN Client with network pre-selected)

**Network Entry Details:**
- Network Name: "Client A - Corporate Network"
- Description: "Client network for mission briefing XYZ"
- Address: "10.50.0.0/16"
- Credentials: Encrypted authentication tokens
- Access Level: "Read/Write" or "Read Only"
- Expiration: Some networks expire after mission completion

**How Entries Are Added:**
- Mission messages include Network Address Register entry attachments
- **Player must CLICK attachment** to add entry to NAR (not automatic)
- Clicking attachment adds network with credentials to NAR
- Entry includes credentials needed for VPN connection
- Player doesn't manually add entries (managed by SourceNet via attachments)

**Quick Connect Feature:**
- Click "Connect" button on any network entry
- Opens VPN Client with that network pre-selected in dropdown
- "Connect" button active immediately
- Streamlines connection workflow

**Integration:**
- VPN Client reads from this app to show available networks in dropdown
- Acts as credential store for network connections
- **Auto-Expiration:** Mission completion automatically expires network credentials

**Credential Expiration System:**
- When mission completes (success or failure), associated network credentials expire
- NAR entry remains but shows "Expired" status
- Expired networks:
  - Cannot connect to (greyed out in VPN Client dropdown)
  - Entry shows: "Status: Expired - Mission Complete"
  - Can be manually removed from NAR (cleanup)
- Prevents accessing mission networks after mission ends
- Security: Simulates real client network access revocation

### 4. File Manager

**Application Name:** File Manager

**Purpose:** Access and manipulate files on networked file systems

**Acquisition:** FREE - Received as attachment in manager's first tutorial message

**Requirements:** Must have discovered file system via Network Scanner

**Interface:**

**Connection Selection:**
- Dropdown: "Select File System"
- Shows discovered file systems from Network Scanner results
- Format: "192.168.1.50 - FileServer01 (ClientA Network)"
- One connection per File Manager instance

**Connected View:**
- Current path display (e.g., "/logs/2024/")
- Directory listing:
  - Folders (can navigate into)
  - Files with detailed display:
    - File name
    - Size (KB/MB)
    - Modified date
    - **Corruption status: Visual indicator (warning icon + red highlight for corrupted files)**
    - Normal files: Standard display
    - Corrupted files: **Red warning icon + red text color** (clearly visible)
- File operations buttons (top of app):
  - **Copy** - Copy selected file(s)
  - **Paste** - Paste copied files (enabled when clipboard has files)
  - **Delete** - Delete selected file(s)
  - **Repair** - Repair corrupted files (button enabled when corrupted files selected)
- Navigation: Back button, Up directory button

**File Operations:**

**Copy/Paste Mechanism:**
1. Select file(s) in one File Manager instance
2. Click "Copy" button
3. "Paste" button enables on ALL File Manager instances
4. Open different File Manager (or use same one)
5. Navigate to destination
6. Click "Paste" to copy files
7. **Important:** If source File Manager closes, clipboard clears (cannot paste)

**Corruption Detection & Display:**
- **Automatic Detection:** File Manager automatically detects corrupted files when directory loads
- **Visual Indicators:**
  - Corrupted files: Red warning icon (⚠) + red text color
  - Normal files: Standard black text, no icon
  - User can immediately see which files are corrupted
- **Repair Functionality:**
  - Select corrupted file(s)
  - "Repair" button becomes enabled (greyed out for normal files)
  - Click "Repair" to fix corrupted files
  - Repair process: Progress bar (5-10 seconds per file)
  - After repair: Icon removed, text color returns to normal
- **Tutorial Mission:** Part 1 extensively uses corruption detection and repair

**Multiple Instances:**
- Can open multiple File Manager windows simultaneously
- Each connects to different file system
- Enables copying between different machines/networks
- Tutorial Part 2 teaches this (two instances open)

**Disconnection Handling:**
- If VPN disconnects from network, File Manager shows "Disconnected" overlay
- Overlay options:
  - Close instance
  - Select different file system from another connected network
- Cannot perform operations while disconnected
- Clipboard clears if disconnected from source file system

**Mission Integration:**
- Most missions involve file operations (copy, repair, delete)
- Tutorial extensively teaches File Manager usage
- Post-tutorial missions: Backup restoration, file repairs

### 5. Password Cracker

**Application Name:** PassBreaker

**Purpose:** Crack password hashes and authentication (Phase 3+)

**Status:** Not included in Phase 2 tutorial missions

**Price:** 400 credits

**Requirements:** 2GHz processor minimum (for cracking speed)

**Interface:**

**Main View:**
- Input section: "Password Hash" text area
- Hash type dropdown: "MD5", "SHA-1", "SHA-256", "NTLM"
- Attack method: "Dictionary Attack", "Brute Force"
- "Start Cracking" button
- Results panel

**Cracking Process:**
1. Paste password hash (obtained from previous mission step)
2. Select hash type (mission briefing usually specifies)
3. Choose attack method:
   - Dictionary Attack: Faster (30-60 seconds), works on common passwords
   - Brute Force: Slower (2-5 minutes), works on all passwords up to 8 chars
4. Click "Start Cracking"
5. Progress bar shows attempts/second (based on CPU speed)
6. Success: Shows cracked password
7. Failure: "Unable to crack - try different method"

**CPU Speed Impact:**
- 1GHz Single Core: 1000 attempts/second (slow)
- 2GHz Dual Core: 5000 attempts/second (moderate)
- 3GHz Dual Core: 10000 attempts/second (fast)
- 4GHz Quad Core: 25000 attempts/second (very fast)
- 6GHz Octa Core: 50000 attempts/second (extremely fast)

**Mission Integration:**
- Mission provides hash to crack
- Successfully cracking password completes objective
- Password used in subsequent mission steps

### 4. SourceNet Mission Board

**Application Name:** SourceNet Mission Board

**Purpose:** Central hub for mission management

**Price:** Free (pre-installed with OS)

**Interface:** (Detailed above in Mission System Design section)

### Additional Software (Future Mission Requirements)

**5. Vulnerability Scanner**
- **Price:** 800 credits
- **Purpose:** Automated security vulnerability detection
- **Requirements:** 4GB RAM minimum

**6. File Extractor**
- **Price:** 600 credits
- **Purpose:** Extract files from remote systems
- **Requirements:** 500MB network adapter minimum

**7. Encryption Breaker**
- **Price:** 1,500 credits
- **Purpose:** Decrypt encrypted files and communications
- **Requirements:** 3GHz Dual Core minimum, 8GB RAM

---

## Banking App Updates

### Transaction History

**New Tab in SNet Banking App:** Transaction History

**Interface:**
- Shows all financial transactions in chronological order (newest first)
- Each transaction displays:
  - Date/Time (in-game time)
  - Description (e.g., "Mission Payout - Client A", "Purchase - Network Scanner")
  - Amount with **color coding:**
    - **Green text:** + amounts (income)
    - **Red text:** - amounts (expenses)
  - Balance after transaction
- Filter options: "All", "Income", "Expenses"
- Date range selector

**Transaction Types:**

**Income (Green):**
- Mission payouts: "+ [amount] credits - Mission: [Mission Name]"
- Cheque deposits: "+ [amount] credits - Cheque Deposit"

**Expenses (Red):**
- Software purchases: "- [amount] credits - Software: [Item Name]"
- Mission failures: "- [amount] credits - Mission Failure Penalty: [Mission Name]"
- Interest charges: "- [amount] credits - Overdraft Interest"
- Hardware purchases (Phase 3+): "- [amount] credits - Hardware: [Item Name]"

**Starting Balance Transaction:**
- First entry shows starting balance of 0 (neutral color)

**Transaction Notifications:**
- **Every transaction** triggers banking notification in top bar
- Notification badge increments
- Hover shows recent transactions
- Click opens Banking App to Transaction History tab

---

## Tutorial Mission Design

**Tutorial Approach:**
- **2-part narrative tutorial** that teaches Phase 2 concepts through dramatic story
- Part 1: Intentional failure - teaches consequences, introduces tools
- Part 2: Recovery mission - teaches multi-instance apps, file operations
- Manager guides via messages, but player uses Mission Board for mission management
- Creates emotional engagement and urgency through debt crisis

**Key Teaching Goals:**
1. SourceNet VPN Client for accessing private networks
2. Network Address Register for managing network connections
3. Network Scanner for discovering machines and file systems
4. File Manager for file operations (repair, copy, delete)
5. Mission Board app for accepting/tracking missions
6. Understanding mission failure and consequences
7. Multiple app instances (two File Managers open simultaneously)
8. Software installation from message attachments (free licenses)
9. Mission objective tracking and completion
10. Reputation and bankruptcy systems
11. Overdraft interest mechanics

---

## Tutorial Part 1: "Log File Repair" (Intentional Failure)

**Trigger:** 20 seconds after manager's welcome message in Phase 1

**Starting Conditions:**
- Player has 1,000 credits (from Phase 1 welcome bonus)
- Reputation: Superb (Tier 9)
- No mission software installed yet
- **Mission Board NOT installed yet**

---

### Message 1: Manager - Mission Board License

**Trigger:** 20 seconds after Phase 1 manager welcome message

**From:** [Manager Name] (SNET-MGR-XXX-XXX)
**Subject:** Get Ready for Your First Mission
**Attachments:**
- SourceNet Mission Board (Software License - $250 value)

**Body:**
```
Hey [username]!

Now that you're all set up, it's time to get you started with actual work.

I've attached a license for the SourceNet Mission Board application. This is
where you'll find all available missions from our clients.

To get started:

1. Click the attachment above to add the Mission Board license to your account
2. Open the OSNet Portal from your app launcher
3. Go to Software section - you'll see "SourceNet Mission Board" marked as "Licensed"
4. Download and install it
5. Once installed, open the Mission Board from your app launcher

I've posted your first assignment there. It's a straightforward file repair job
for one of our clients - perfect for learning the ropes.

After you install the Mission Board and accept the mission, I'll send you the
software licenses you'll need to complete it.

- [Manager Name]
```

**Player Actions:**
1. Click attachment to add Mission Board license
2. Open Portal
3. Install Mission Board (shows: "SourceNet Mission Board - $250 - Licensed - Requires 200 MB")
4. Wait for download/install
5. Open Mission Board app

---

### Message 2: Manager - Tutorial Mission + Software Licenses

**Trigger:** Player accepts "Log File Repair" mission from Mission Board

**From:** [Manager Name] (SNET-MGR-XXX-XXX)
**Subject:** Mission Software & Network Access
**Attachments:**
- SourceNet VPN Client (Software License - $500 value)
- Network Address Register (Software License - $200 value)
- Network Scanner (Software License - $300 value)
- File Manager (Software License - $350 value)
- ClientA-Corporate Network (Network Address Register Entry)

**Body:**
```
Great! You've accepted the mission. Now let me get you set up with everything
you need to complete it.

I've attached free licenses for the software tools you'll need (total value: $1,350):

- SourceNet VPN Client ($500 value): Secure access to client networks
- Network Address Register ($200 value): Manages your network connections
- Network Scanner ($300 value): Finds machines and file systems on networks
- File Manager ($350 value): Access and repair files on remote systems

I've also attached the network credentials for ClientA-Corporate. Click that
attachment to add it to your Network Address Register.

Installation steps:

1. Click all the attachments above to add them to your account
2. Open the Portal and install all four software applications
3. Once installed, you'll be ready to start the mission

The mission is simple:
- Connect to ClientA-Corporate network via VPN
- Scan the network to find their file server
- Use File Manager to detect and repair corrupted log files

Check your Mission Board - it'll show you each objective as you progress.

Good luck!

- [Manager Name]
```

**When Attachments Clicked:**
- Each attachment adds corresponding software license to player's Portal account
- Portal shows these apps with "Licensed" badge instead of price
- Player must manually download/install each from Portal
- Standard installation process (download progress based on network speed)

### Mission Board Entry (Part 1)

**Mission Title:** Log File Repair

**Client:** Client A - TechCorp Industries

**Difficulty:** Beginner

**Payout:** 2,000 credits

**Requirements:**
- SourceNet VPN Client (Licensed)
- Network Scanner (Licensed)
- File Manager (Licensed)

**Description:**
"Client reports corrupted log files on their primary file server. Connect to their network, locate the corrupted files, and repair them using standard file recovery procedures."

### Mission Briefing (Shown After Accepting in Mission Board)

```
MISSION BRIEFING: Log File Repair
Classification: File System Maintenance
Client: Client A - TechCorp Industries

BACKGROUND:
TechCorp Industries has discovered corrupted log files on their primary
file server. These logs are critical for their audit compliance and must
be repaired immediately.

OBJECTIVES:
1. Install required software from Portal (if not already installed)
2. Connect to Client A network via VPN
3. Use Network Scanner to locate file server
4. Access file server using File Manager
5. Detect corrupted log files
6. Repair all corrupted files
7. Verify repairs complete

NETWORK DETAILS:
- Network Name: "ClientA-Corporate"
- Network credentials have been added to your Network Address Register
- Expected file server hostname: "fileserver-01"

MISSION NOTES:
- All required software provided as free licenses (check attachments)
- This is a straightforward file repair job
- Client is paying 2,000 credits for timely completion
- Your manager will guide you through each step

TIME ESTIMATE: 10-15 minutes

PAYOUT: 2,000 credits
```

### Mission Flow (Part 1 - Step by Step)

**Step 1: Software Installation**
- Player has manager's message with 4 software license attachments
- Opens Portal → Software section
- Sees 4 apps marked as "Licensed" (free):
  - SourceNet VPN Client
  - Network Address Register
  - Network Scanner
  - File Manager
- Downloads and installs all 4 apps
- Installations complete (based on network speed)
- Manager message arrives: "Good! Now open the Mission Board and accept the 'Log File Repair' mission"

**Step 2: Accept Mission**
- Player opens SourceNet Mission Board app (installed from manager's license)
- Sees "Log File Repair" in Available Missions tab
- Clicks mission → Reads briefing
- Clicks "Accept Mission"
- Mission moves to Active Mission tab
- Objective list appears

**Objective 1: Connect to ClientA-Corporate network via VPN**
- Mission Board shows: "☐ Connect to ClientA-Corporate network"
- Player opens SourceNet VPN Client
- "ClientA-Corporate" appears in network dropdown (from Network Address Register)
- Player selects network and clicks "Connect"
- Connection establishes (3-5 seconds)
- Top bar network indicator shows "1" connection
- ✓ Objective 1 Complete (Mission Board updates: "☑ Connected to ClientA-Corporate")

**Manager Message:**
"Good work! You're connected. Now use the Network Scanner to find their file server."

**Objective 2: Use Network Scanner to locate file server**
- Mission Board shows: "☐ Scan network to find fileserver-01"
- Player opens Network Scanner
- Dropdown shows "ClientA-Corporate" (currently connected network)
- Player selects network, chooses "Deep Scan"
- Clicks "Start Scan"
- Scan takes 15 seconds
- Results show:
  - 192.168.50.10 - fileserver-01 (File System: /logs/)
  - Other machines (not relevant)
- ✓ Objective 2 Complete (Mission Board updates: "☑ File server located")

**Manager Message:**
"Perfect! Now open File Manager and connect to that file system."

**Objective 3: Access file server using File Manager**
- Mission Board shows: "☐ Connect to fileserver-01 file system"
- Player opens File Manager
- Dropdown shows: "192.168.50.10 - fileserver-01 (ClientA-Corporate)"
- Player selects it
- File Manager connects, shows directory: /logs/
- Lists multiple files, several with warning icons (corrupted)
- ✓ Objective 3 Complete (Mission Board updates: "☑ Connected to file server")

**Manager Message:**
"I see 8 corrupted files. Use the Repair function to fix them."

**Objective 4: Repair corrupted log files**
- Mission Board shows: "☐ Repair all corrupted files (0/8)"
- File Manager shows 8 files with corruption warnings (red icons, red text)
- Player selects all corrupted files
- Clicks "Repair" button
- Progress bars appear (5 seconds per file, total ~40 seconds)
- Files repair one by one
- Mission Board updates progress: "☐ Repair all corrupted files (3/8)... (6/8)..."
- All 8 files repaired successfully (icons removed, text returns to normal)
- ✓ Objective 4 Complete (Mission Board updates: "☑ All files repaired (8/8)")

**Manager Message:**
"Excellent work! All files repaired. Stand by while I verify with the client..."

**AUTOMATIC MISSION COMPLETION BEGINS (5 seconds after repairs complete):**
- Mission Board shows: "Mission Completing..."
- Status: "Verifying results with client..."
- **NO manual submit button needed - completion is automatic**

**BUT THEN... THE SABOTAGE EVENT (Scripted - 3 seconds into verification)**

- File Manager suddenly shows new activity (WITHOUT player input)
- Files start DELETING one by one
- Visual: Red progress bars showing "Deleting log_2024_01.txt... 45%..."
- Files disappear from directory listing
- All 8 repaired files deleted within 10 seconds
- Player cannot stop this (all buttons disabled during deletion)
- Mission Board: "Mission Completing..." changes to "WARNING: Unexpected activity detected"

**Immediately after deletion:**
- VPN connection forcibly disconnected by network administrator
- Top bar network indicator drops to "0"
- File Manager shows "Disconnected - Network administrator terminated connection" overlay
- SourceNet VPN Client shows: "Connection terminated by remote host"

**Mission Board updates:**
- Objective 4 changes: "☒ FAILED - Files deleted instead of repaired"
- Mission Status: "FAILED"
- Red banner: "Mission Failed - Client notified of data loss"
- **Mission automatically moves to Completed Missions tab with FAILED status**

### Failure Consequence Messages

**Message 2: Manager - Angry Response (Arrives 10 seconds after failure)**

**From:** [Manager Name] (SNET-MGR-XXX-XXX)
**Subject:** What happened?!
**Body:**
```
[username],

What just happened?! I was monitoring your mission and I saw you DELETE
all the log files instead of repairing them!

The client's network administrator had to forcibly disconnect you to prevent
further damage. Those files were CRITICAL for their audit compliance!

The client is demanding 10,000 credits in compensation for the data loss and
the emergency recovery procedures they now have to perform. SourceNet policy
requires YOU to cover mission failures, so that amount has been deducted from
your account.

Your reputation has taken a serious hit. You went from Superb to Accident Prone.
I know you impressed us in the interview, but this is completely unacceptable.

You need to be EXTREMELY careful. DO NOT become bankrupt. If you're overdrawn
by more than 10,000 credits for 5 minutes, the financial authorities will seize
your assets and SourceNet will not protect you.

I'm giving you another chance, but you need to prove you can handle this work.

- [Manager Name]
```

**Message 3: Bank - Overdraft Notice (Arrives 5 seconds after manager message)**

**From:** First Bank Ltd (SNET-FBL-000-001)
**Subject:** Overdraft Notice - Interest Charges Apply
**Body:**
```
Dear [username],

Your account with First Bank Ltd is currently overdrawn.

Current Balance: -9,000 credits
Overdraft Interest Rate: 1% per minute (in-game time)

Interest will be charged every minute until your balance returns to positive.

BANKRUPTCY WARNING:
If your account remains overdrawn by MORE than 10,000 credits for 5 consecutive
minutes, your account will be referred to financial authorities for asset seizure.

We recommend depositing funds immediately to avoid further charges.

Sincerely,
First Bank Ltd
```

**Game State After Failure:**
- Credits: -9,000 (started 1,000, penalty -10,000)
- Reputation: Accident Prone (Tier 3) - dropped from Superb (Tier 9)
- Reputation display in top bar: Orange icon, tier 3
- Interest accumulating: -90 credits/min at 1x speed, -900 credits/min at 10x speed
- Mission Board: "Log File Repair" moved to Completed Missions (FAILED status)
- Bankruptcy threshold: -10,000 (only 1,000 away!)
- Player feels: Shocked, panicked, motivated to recover

---

## Tutorial Part 2: "Log File Restoration" (Recovery Mission)

**Trigger:** 30 seconds after Part 1 failure messages

**Player State:**
- Credits: -9,000 (and decreasing from interest)
- Reputation: Accident Prone (Tier 3)
- Feeling: Panicked, need to earn credits fast

### Message 4: Manager - Recovery Mission (Arrives 30 seconds after Part 1 failure)

**From:** [Manager Name] (SNET-MGR-XXX-XXX)
**Subject:** Let's try something simpler
**Body:**
```
[username],

Okay, I know that was rough. Let me give you a simpler task to help you recover.

The same client (TechCorp) kept backups of those log files you... deleted. They
need you to RESTORE the backups by copying them back to the original location.

This should be straightforward - just copy files from one location to another.
No repairing, no deleting, just copying. You can handle that, right?

Here's what you need to do:

1. Open the Mission Board and accept "Log File Restoration"
2. Reconnect to ClientA-Corporate network (they've re-authorized you)
3. Use Network Scanner to find BOTH file systems:
   - fileserver-01 (original location - currently empty)
   - backup-server (backup location - has the files you need to copy)
4. Open TWO File Manager windows - one for each file system
5. Copy all log files FROM backup-server TO fileserver-01

This mission pays 1,000 credits. It won't get you out of debt, but it's a start.

You need to work until you're back in the black (not overdrawn anymore). There
are several missions available after this one - all basic file work. Boring stuff,
but you're not in a position to be picky right now given your situation.

Once you're out of debt, I'll reach out again with better work.

Don't mess this one up.

- [Manager Name]
```

### Mission Board Entry (Part 2)

**Mission Title:** Log File Restoration

**Client:** Client A - TechCorp Industries

**Difficulty:** Beginner

**Payout:** 1,000 credits

**Requirements:**
- SourceNet VPN Client
- Network Scanner
- File Manager

**Description:**
"Restore backup log files to primary file server. Copy all files from backup-server to fileserver-01."

### Mission Briefing (Part 2)

```
MISSION BRIEFING: Log File Restoration
Classification: Data Recovery
Client: Client A - TechCorp Industries

BACKGROUND:
Following the recent incident, TechCorp needs their log files restored from
backups. This is a straightforward file copy operation.

OBJECTIVES:
1. Reconnect to ClientA-Corporate network
2. Scan network to locate both file systems
3. Open File Manager for backup-server
4. Open second File Manager for fileserver-01
5. Copy all 8 log files from backup to original location
6. Verify all files copied successfully

NETWORK DETAILS:
- Network Name: "ClientA-Corporate"
- Source: backup-server (192.168.50.20)
- Destination: fileserver-01 (192.168.50.10)
- 8 files to copy

MISSION NOTES:
- Simple file copy operation
- No repairs or modifications needed
- Use two File Manager windows simultaneously
- Payment: 1,000 credits

TIME ESTIMATE: 5-10 minutes

PAYOUT: 1,000 credits
```

### Mission Flow (Part 2 - Step by Step)

**Objective 1: Reconnect to ClientA-Corporate**
- Player opens VPN Client
- Connects to "ClientA-Corporate" (re-authorized)
- ✓ Objective 1 Complete

**Objective 2: Scan network to find both file systems**
- Player opens Network Scanner
- Selects "ClientA-Corporate", runs Deep Scan
- Results show:
  - 192.168.50.10 - fileserver-01 (File System: /logs/) - EMPTY
  - 192.168.50.20 - backup-server (File System: /backups/logs/) - HAS FILES
- ✓ Objective 2 Complete
- **Note:** In Part 1, backup-server was NOT discoverable. Now it appears (time-based discovery)

**Objective 3: Connect first File Manager to backup-server**
- Player opens File Manager
- Selects "192.168.50.20 - backup-server"
- Connects, shows /backups/logs/ with 8 log files
- ✓ Objective 3 Complete

**Objective 4: Connect second File Manager to fileserver-01**
- Player opens SECOND File Manager window (multiple instances!)
- Selects "192.168.50.10 - fileserver-01"
- Connects, shows /logs/ directory (empty)
- ✓ Objective 4 Complete
- **Teaching moment:** Two File Manager windows open simultaneously

**Objective 5: Copy all files from backup to original location**
- Mission Board shows: "☐ Copy all files (0/8)"
- In backup-server File Manager: Player selects all 8 files
- Clicks "Copy" button
- "Paste" button enables on BOTH File Manager instances
- Switches to fileserver-01 File Manager
- Clicks "Paste"
- Files copy over (progress bars, ~20 seconds total)
- fileserver-01 now shows all 8 files
- ✓ Objective 5 Complete (Mission Board: "☑ All files copied (8/8)")

**AUTOMATIC MISSION COMPLETION (Few moments after all files copied):**
- Mission Board shows: "Mission Completing..."
- Status: "Verifying files with client..."
- **NO manual submit - completion is automatic**
- 5 seconds later: Mission Status changes to "COMPLETE"
- Banking notification: +1,000 credits
- Mission automatically moves to Completed Missions tab (SUCCESS status)
- ✓ Mission Complete - SUCCESS!

### Part 2 Success Messages

**Message 5: Manager - Well Done (Arrives after Part 2 completion)**

**From:** [Manager Name] (SNET-MGR-XXX-XXX)
**Subject:** Better
**Body:**
```
[username],

Okay, that's more like it. Simple task, executed correctly.

You're still deep in debt (-8,000 credits), but at least you're moving in the
right direction.

Due to the recent global security exploit, there's a LOT of work available right
now - mostly boring backup and file repair jobs. Not exciting work, but you need
to take what you can get until you're back in the black.

Check the Mission Board - there are several missions available. Work through them
until your account is positive again. Once you're out of debt, I'll reach out
with better opportunities.

Your reputation is still "Accident Prone" after that first mission disaster. You'll
need to successfully complete missions to rebuild it.

Keep working.

- [Manager Name]
```

**Game State After Part 2 Success:**
- Credits: -8,000 (was -9,000, earned 1,000)
- Reputation: Still Accident Prone (Tier 3) - needs more successes to improve
- Interest still accumulating: -80 credits/min at 1x speed
- Mission Board: "Log File Restoration" in Completed Missions (SUCCESS)
- Multiple new missions appear in Available Missions tab (post-tutorial pool)
- Tutorial complete - player now on their own

---

## Post-Tutorial Mission Pool

**Purpose:** Provide simple missions for player to earn way out of debt

**Availability:** After completing Tutorial Part 2

**Mission Characteristics:**
- All use same tools (VPN, Network Scanner, File Manager)
- No manager guidance - player works independently
- Cannot retry failed missions (permanent failure)
- Reputation affects available missions (Accident Prone = Easy only)
- Each mission starts with message containing network credentials

### Post-Tutorial Mission Types

**Type 1: File Backup (Simple)**
- **Payout:** 800-1,000 credits
- **Task:** Copy files from one location to another
- **Teaches:** Basic file copying (already learned in tutorial)
- **Example:** "Backup Configuration Files" - Copy system configs to backup location
- **Failure Consequence:** -500 credits, -1 reputation tier
- **No retry** after failure

**Type 2: File Repair (Moderate)**
- **Payout:** 1,000-1,200 credits
- **Task:** Detect and repair corrupted files
- **Teaches:** File repair function (already learned in tutorial)
- **Example:** "Repair System Logs" - Fix corrupted log files on client server
- **Failure Consequence:** -800 credits, -1 reputation tier
- **No retry** after failure

**Type 3: File Restoration (Moderate)**
- **Payout:** 1,200-1,500 credits
- **Task:** Restore files from backup to multiple locations
- **Teaches:** Multiple File Manager instances, complex copying
- **Example:** "Restore Database Backups" - Copy backup files to 3 different servers
- **Failure Consequence:** -1,000 credits, -1 reputation tier
- **No retry** after failure

**Type 4: Combined Tasks (Harder - Requires higher reputation)**
- **Payout:** 1,500-2,000 credits
- **Task:** Multiple steps - repair, backup, verify
- **Reputation Required:** "Can work with help" (Tier 4) or better
- **Example:** "System Recovery" - Repair files, backup to secondary, verify integrity
- **Failure Consequence:** -1,500 credits, -2 reputation tiers
- **No retry** after failure

### Mission Availability

**After Tutorial (Reputation: Accident Prone - Tier 3):**
- 3-5 Type 1 missions (File Backup)
- 2-3 Type 2 missions (File Repair)
- No Type 3 or 4 missions (reputation too low)

**As Reputation Improves:**
- Tier 4 (Can work with help): Type 3 missions unlock
- Tier 5 (OK): Type 4 missions unlock
- Tier 6+ (Semi-competent): Better missions appear (Phase 3+)

### Recovery Path

**Player at -8,000 credits after tutorial:**
- Needs 8-10 missions to break even (assuming 800-1,000 per mission)
- Takes ~1-2 hours of gameplay (if player efficient)
- Interest working against player (~80-90 credits/min at 1x speed)
- Cannot afford to fail (no retries, failure costs credits)

**Risk vs. Reward:**
- Higher-paying missions have higher failure penalties
- Player must balance speed (interest pressure) vs. safety (avoid failures)
- Encourages careful, methodical work

### Mission Message Format

**Each mission starts with message:**
```
From: SourceNet Operations (SNET-OPS-000-001)
Subject: Mission Available - [Mission Title]
Attachments:
- [Network Name] (Network Address Register Entry)

A new mission is available on your Mission Board.

Client: [Client Name]
Task: [Brief Description]
Payout: [Credits]

Network credentials attached. Click the attachment above to add the network
to your Network Address Register before starting the mission.

Accept this mission from your Mission Board when ready.

- SourceNet Operations
```

**Player Actions:**
1. Read message
2. **Click network attachment** to add to Network Address Register
3. Open Mission Board
4. Accept mission
5. Follow mission objectives

**No manager involvement** - player works independently

**Mission Completion:**
- **Automatic** after all objectives complete
- "Mission Completing..." status appears
- Few moments later (3-5 seconds): SUCCESS or FAILED
- Credits awarded/deducted automatically
- Mission moves to Completed Missions tab

---

## Game Balance & Progression

### Starting Economy (Phase 2)

**Starting State (from Phase 1):**
- 1,000 credits (welcome bonus from Phase 1)
- Reputation: Superb (Tier 9)
- Software: OSNet, Portal, Mail, Banking (from Phase 1)

**Tutorial Free Software (Total Value: $1,600):**
- Mission Board: $250 (free license from manager)
- VPN Client: $500 (free license in tutorial)
- Network Address Register: $200 (free license in tutorial)
- Network Scanner: $300 (free license in tutorial)
- File Manager: $350 (free license in tutorial)
- **Player pays: $0** (all licenses free)

**Tutorial Mission Outcomes:**
- Part 1 (Failure): -10,000 credits penalty
- Part 2 (Success): +1,000 credits payout

**Net Position After Tutorial:**
- Started: 1,000 credits
- Software cost: $0 (all free licenses)
- Part 1 penalty: -10,000 credits
- Part 2 payout: +1,000 credits
- **Final Balance: -8,000 credits**
- **Reputation: Accident Prone (Tier 3)**

**Why This Design:**
- Player receives valuable tools free ($1,600 value) - feel grateful
- Dramatic failure creates emotional engagement
- Deep debt creates urgency and tension
- Forces engagement with mission system immediately
- Reputation loss motivates rebuilding through successful missions
- Tutorial teaches consequences before high-stakes play

### Early Game Progression (Post-Tutorial Recovery)

**Player State After Tutorial:**
- Credits: -8,000 (deep debt)
- Reputation: Accident Prone (Tier 3)
- Interest: -80 credits/min at 1x speed
- Software: All tutorial tools owned (VPN, NAR, Scanner, File Manager)
- **Goal:** Work back to positive balance

**Recovery Phase (Missions 1-5):**
- **Available Missions:** File Backup, File Repair (Tier 1 & 2)
- **Payout:** 800-1,200 credits × reputation multiplier (0.85x at Tier 3)
- **Actual Earnings:** 680-1,020 credits per mission
- **Cannot fail:** No retries, failure worsens debt
- **Goal:** Escape debt (need ~8-10 missions)

**Mid-Recovery (Missions 6-10):**
- **Reputation:** Improving (Tier 4-5 "Can work with help" / "OK")
- **Payout Multiplier:** 1.0x (standard pay)
- **Available Missions:** File Restoration unlocked (Tier 3)
- **Earnings:** 1,000-1,500 credits per mission
- **Goal:** Break even, build small reserve

**Out of Debt (Mission 10+):**
- **Credits:** Positive balance (+500 to +2,000)
- **Reputation:** Tier 5-6 ("OK" / "Semi-competent")
- **Manager Contact:** "You're back in the black. I have better work for you now." (Phase 3+ lead-in)
- **Available Missions:** Higher-tier missions unlock
- **Goal:** Build credit reserve, improve reputation

### Phase 2 Progression Constraints

**No Hardware Purchasing:**
- Hardware upgrades deferred to Phase 3+
- Starting hardware sufficient for all Phase 2 missions
- Storage: 90 GB SSD (plenty of space for Phase 2 software)
- Network: 250 Mbps adapter (adequate for downloads + file copying)
- CPU: 1 GHz (missions don't require processor-intensive operations in Phase 2)

**Phase 2 Mission Types (File Operations Only):**
- No password cracking (PassBreaker not needed)
- No vulnerability scanning (Vulnerability Scanner not needed)
- Focus: File backups, repairs, restoration
- Progression through reputation improvement, not hardware

### Software in Phase 2

**Core Mission Software (All Free in Tutorial):**
- SourceNet Mission Board: $250
- SourceNet VPN Client: $500
- Network Address Register: $200
- Network Scanner: $300
- File Manager: $350
- **Total Value:** $1,600 (all received free)

**Additional Purchasable Software (Phase 2):**
- Limited additional software in Portal (if any)
- Focus is on mastering the core tools
- More software unlocks in Phase 3+ with new mission types

**No Software Purchasing Needed:**
- Tutorial provides all necessary tools
- Post-tutorial missions use same tools
- Phase 2 is about learning systems, not upgrading equipment

---

## UI/UX Changes

### Top Bar Updates

**New UI Elements Added:**

**1. Network Connection Indicator (Center-Right Section):**
- **Icon:** Network/WiFi icon with badge
- **Badge Number:** Shows count of active network connections (e.g., "2")
- **Hover Behavior:** Shows list of connected networks
  - Each network listed with name and "Disconnect" button
  - Example: "Client A - Corporate Network [Disconnect]"
  - Hover list allows individual disconnection
- **No Connections:** Icon appears greyed out, badge shows "0"
- **Visual State:**
  - Green icon = connected
  - Grey icon = no connections
  - Yellow icon = connecting (animated)

**2. Reputation Display (Next to Credits Display):**
- **Icon:** Badge/Star icon with color coding
- **Color Scale:** Bad (Red) → OK (Yellow) → Good (Green) → Excellent (Gold)
- **Hover Behavior:** Shows reputation tier name and description
  - Example: "Accident Prone - Recent mission failures require improvement"
- **11 Reputation Tiers:**
  1. Should be let go (Red - worst)
  2. On performance plan (Dark Red)
  3. Accident prone (Red/Orange)
  4. Can work with help (Orange)
  5. OK (Yellow)
  6. Semi-competent (Light Green)
  7. Reliable (Green)
  8. High achiever (Bright Green)
  9. Superb (Blue-Green)
  10. Ace agent (Blue)
  11. Star employee (Gold - best)
- **Starting Reputation:** Superb (tier 9) - "You impressed us in the interview"
- **Tutorial Part 1 Failure:** Drops to Accident Prone (tier 3)

**3. Active Mission Indicator (Only When Mission Active):**
- **Icon:** Mission/clipboard icon with badge
- **Badge Number:** Shows count of incomplete objectives (e.g., "3")
- **Appears:** Only when player has active mission
- **Hidden:** When no active mission
- **Hover Behavior:** Popup shows all mission objectives
  - Completed objectives: ☑ Green checkmark + strikethrough
  - Incomplete objectives: ☐ Normal text
  - Example popup:
    ```
    Log File Restoration (3/5 complete)
    ☑ Connect to ClientA-Corporate
    ☑ Scan network
    ☑ Connect to backup-server
    ☐ Copy files (0/8)
    ☐ Verify completion
    ```
- **Click Behavior:** Opens Mission Board to Active Mission tab
- **Visual State:**
  - Blue icon = mission in progress
  - Green icon = all objectives complete (auto-completing)
  - Red icon = mission failed

**4. Bankruptcy Warning (Only When Active):**
- **Appears:** When overdrawn by >10k for 5 minutes
- **Display:** Red flashing banner across top bar
- **Message:** "BANKRUPTCY WARNING: [X] minutes remaining"
- **Countdown Timer:** Shows minutes:seconds until asset seizure
- **Color:** Red background, white text, flashing animation
- **Priority:** Overlays other top bar elements when active

**Existing Elements:**
- Mail notification (with hover preview)
- Banking notification (shows on transactions)
- Credits display (clickable)
- Power menu, time display, time speed toggle (unchanged from Phase 1)

### Desktop Updates

**Installation Queue Widget:**
- **Location:** Bottom-right corner of desktop (above minimized window bar)
- **Appearance:** Small, compact widget (doesn't interfere with windows)
- **Shows:** Currently downloading/installing items
- **Format:**
  ```
  [↓] NetScan Pro - 67%
  [↓] PassBreaker - 12%
  ```
- **States:**
  - [↓] = Downloading
  - [⚙] = Installing
- **Click Behavior:** Opens detailed Installation Queue modal
- **Auto-Hide:** Disappears when queue is empty

**Installation Queue Modal:**
- Shows all items in queue
- Each item displays:
  - Name
  - Status (Downloading / Installing)
  - Progress bar
  - Estimated time remaining (based on current time speed)
  - Size (MB)
- "Pause All" / "Resume All" buttons (pauses downloads, not installations)
- "Cancel Download" button per item (before installation starts)

### App Launcher Updates

**Storage Display (Bottom of App Launcher Menu):**
- **Location:** At bottom of app launcher hover menu
- **Display:** "45.2 GB used / 90 GB free"
- **Updates:** Real-time as software installed/removed
- **Calculation:**
  - OSNet OS: ~12 GB (base operating system)
  - Each installed app: Shown space requirement
  - Free space: Total SSD capacity - used space
- **Example:**
  - Starting: 90 GB SSD, OSNet (12 GB) = 12 GB used / 78 GB free
  - After Mission Board: +0.2 GB = 12.2 GB used / 77.8 GB free
  - After VPN + NAR + Scanner + File Manager: +1.5 GB = 13.7 GB used / 76.3 GB free
- **Color Coding (Future):**
  - Green: >20% free
  - Yellow: 10-20% free
  - Red: <10% free (running out of space)

**Software Space Requirements (Examples for Phase 2):**
- OSNet OS: 12 GB (pre-installed)
- SourceNet Mission Board: 200 MB
- SourceNet VPN Client: 500 MB
- Network Address Register: 150 MB
- Network Scanner: 300 MB
- File Manager: 400 MB
- (Other apps in Portal: 200 MB - 1 GB each)

### Window Management Updates

**No Changes Needed:**
- Window system from Phase 1 works perfectly for new apps
- New apps follow same fixed-size window pattern
- Cascade positioning continues to work

---

## Message System Updates

### New Message Types

**Mission-Related Messages:**
- Manager sends messages when:
  - Tutorial mission becomes available
  - Player completes first mission
  - Player reaches mission milestones (5 completed, 10 completed, etc.)
  - New mission types unlock
  - Special events occur

**Banking Notifications:**
- **All transactions** trigger banking notification in top bar
- Notification shows in hover preview
- Click notification opens Banking App to Transaction History

**Portal Notifications:**
- None in Phase 2 (Portal has no notification system)

**Message Deletion:**
- **NOT in Phase 2** - Same as Phase 1, messages can only be archived
- Delete functionality deferred to Phase 3+

---

## Testing Requirements (Phase 2)

### New Test Coverage Needed

#### Mission System Tests
- Mission board displays available missions correctly
- Mission requirements check works (can't accept without required software)
- Mission acceptance works correctly
- Mission objectives track progress accurately
- Mission completion awards correct payout
- Mission history persists through save/load
- Tutorial mission flow works end-to-end
- VPN connection required for mission actions
- Multiple mission types available after tutorial

#### Purchasing System Tests
- Purchase button appears on non-owned items
- Purchase confirmation modal shows correct details
- Insufficient funds prevents purchase
- Purchase deducts correct amount
- Purchased items enter installation queue
- Portal updates to show "Installing..." status

#### Installation System Tests
- Download progress calculates correctly based on network speed
- Download progress updates smoothly
- Installation completes after download
- Software available immediately after installation
- Hardware installation triggers reboot prompt
- Reboot required flag prevents hardware use until reboot
- Multiple downloads can queue simultaneously
- Installation queue widget displays correctly
- Time speed affects download speed correctly

#### Banking Transaction History Tests
- Transaction history tab displays
- All transactions recorded correctly
- Transaction types labeled correctly (income vs expenses)
- Filter options work (All, Income, Expenses)
- Transaction history persists through save/load
- Balance calculations correct after each transaction

#### New Application Tests
- **SourceNet VPN Client:**
  - Lists all connected networks
  - Connect/disconnect works correctly
  - Network dropdown shows NAR networks
  - Can open from NAR with pre-selection
  - Multiple simultaneous connections supported
  - Top bar network indicator updates correctly
- **Network Scanner:**
  - Network dropdown shows connected networks
  - Deep scan finds machines + file systems
  - Time-based discovery works (some machines hidden initially)
  - Results persist until window closed
  - Rescan functionality works
- **Network Address Register:**
  - Entries added by clicking message attachments (not automatic)
  - Click entry opens VPN with pre-selection
  - Expired credentials shown correctly after mission
  - Cannot connect to expired networks
- **File Manager:**
  - Corruption detection automatic (red icons + text)
  - Repair button enabled only for corrupted files
  - Copy/paste works across multiple instances
  - Clipboard clears when source instance closes
  - Disconnection overlay appears when VPN drops
  - Can switch to different file system when disconnected
- **Mission Board:**
  - Requires license installation (not pre-installed)
  - All three tabs work (Available, Active, Completed)
  - Automatic completion after objectives (no submit button)
  - Out-of-range missions shown greyed
  - Active mission indicator in top bar works
  - Reputation gating works correctly
  - Mission failure consequences apply (credits + reputation)

#### E2E Tests (Phase 2)
1. **Complete Tutorial Mission** - Full walkthrough from start to finish (both parts)
2. **Purchase and Install Software** - Buy app from Portal, wait for download, verify installation
3. **Complete Post-Tutorial Mission** - Accept mission, complete objectives, automatic completion, receive payment
4. **Transaction History Flow** - Make purchases, complete missions, verify all transactions recorded
5. **Mission Requirements Check** - Attempt to accept mission without required software, install software, accept mission
6. **VPN Connection Flow** - Connect to VPN, scan network, access file system, disconnect
7. **Installation Queue Management** - Purchase multiple software items, verify queue displays correctly, verify all install successfully
8. **Mission Failure Flow** - Trigger failure condition, verify consequences (credits, reputation), verify no retry option
9. **Bankruptcy Warning Flow** - Drop below -10k, verify countdown, recover above -10k, verify countdown cancels
10. **Reputation Warning Flow** - Drop to Tier 2, verify warning, drop to Tier 1, verify 10-min timer

### Test Coverage Goals (Phase 2)

**Minimum Coverage:**
- Mission system: 90%+
- Purchasing/installation system: 90%+
- New applications: 85%+
- Banking updates: 90%+
- Critical user flows (E2E): 100%

**Overall Target:** 85%+ total code coverage (maintaining Phase 1 standard)

---

## Phase 2 Completion Criteria

Phase 2 is complete when:

### Core Gameplay
- ✓ Mission Board application implemented and functional
- ✓ Tutorial mission works end-to-end
- ✓ At least 5 post-tutorial missions available (3 Easy, 2 Medium)
- ✓ Mission acceptance, progress tracking, and completion works
- ✓ Mission payouts award correct credits
- ✓ Mission requirements checking works correctly

### Economy System
- ✓ Software purchasing works from Portal
- ✓ Purchase confirmation and insufficient funds modals work
- ✓ Installation queue displays and functions correctly
- ✓ Download speeds calculate correctly with bandwidth sharing
- ✓ Software installs correctly and becomes available
- ✓ Software consumes SSD storage (tracked in app launcher)
- ✓ Transaction history records all financial activity
- ✓ Free software licenses work (Portal shows price + "Licensed" badge)

### New Applications
- ✓ SourceNet VPN Client works (connect/disconnect, network listing, mission integration)
- ✓ Network Scanner works (network selection, time-based discovery, file system detection)
- ✓ File Manager works (file operations, copy/paste across instances, corruption detection)
- ✓ Network Address Register works (entry management, quick connect to VPN)
- ✓ Mission Board works (all tabs, mission display, automatic completion)

### Game Flow
- ✓ Player can complete tutorial mission from start to finish
- ✓ Player can purchase required tools during tutorial
- ✓ Player can accept and complete post-tutorial missions
- ✓ Player can upgrade hardware and software
- ✓ Player progression feels rewarding and balanced

### Testing
- ✓ All new systems have comprehensive test coverage (90%+)
- ✓ All E2E flows tested and passing
- ✓ No regressions in Phase 1 functionality
- ✓ Overall code coverage maintains 85%+

---

## Notes for Future Phases

### Phase 3 Potential Features
- Multiple operating systems (different themes/experiences)
- More mission types (Intrusion, Forensics, Social Engineering)
- Advanced mission difficulty tiers (Expert level)
- Mission rewards beyond credits (reputation, special items)
- Branching mission paths
- Time-sensitive missions (deadlines)
- Mission failures and consequences
- Competing contractors (other NPCs doing missions)

### Phase 4+ Potential Features
- Multiplayer/co-op missions
- Custom network builder (design your own security setups)
- Black market (illegal tools and contracts)
- Law enforcement missions (catching bad actors)
- Hardware crafting/customization
- Operating system customization
- Mod support

---

## Design Decisions & Rationale

### Why Only 1 Active Mission at a Time?
- **Focus:** Keeps player focused on one objective
- **Complexity:** Multiple concurrent missions would complicate UI and tracking
- **Balance:** Prevents mission farming and maintains pacing
- **Future Expansion:** Can add mission slots as progression reward in later phases

### Why Require VPN for All Missions?
- **Realism:** Simulates secure connection to client networks
- **Tutorial Value:** Forces player to learn VPN connection process
- **Gating Mechanic:** First significant purchase (500 credits) creates early goal
- **Consistency:** All missions follow same connection pattern

### Why Reboot for Hardware Only? (Phase 3+ Design)
- **Note:** Hardware purchasing not in Phase 2, but design documented for future
- **Realism:** Hardware changes typically require reboot in real systems
- **Game Mechanic:** Creates meaningful difference between software/hardware purchases
- **Pacing:** Reboot takes 7 seconds - minor inconvenience that encourages batch upgrades
- **Technical Simplicity:** Makes hardware state changes cleaner
- **Phase 2:** Software only, no reboots needed for installations

### Why Tutorial Mission Costs More Than It Pays?
- **Engagement:** Forces player to experience both spending and earning
- **Tool Acquisition:** Player ends tutorial with essential tools (baseline for all missions)
- **Motivation:** 300 credits remaining motivates next mission
- **Realism:** Training doesn't usually pay - you invest to learn
- **Balance:** Player quickly recovers investment with first real mission (800-1,200 credits)

### Why CPU Speed Affects Password Cracking?
- **Progression Reward:** Gives tangible benefit to CPU upgrades
- **Realism:** Password cracking is CPU-intensive in real world
- **Game Strategy:** Faster CPU = faster missions = more credits per hour
- **Player Choice:** Creates decision: upgrade CPU for speed vs other upgrades

### Why Network Speed Affects Downloads Only (Not Mission Speed)?
- **Simplicity:** Mission complexity should depend on difficulty, not hardware
- **Balance:** Network speed already valuable (faster tool acquisition)
- **Fairness:** Prevents "pay to win" feeling where rich players breeze through missions
- **Phase 2 Scope:** Mission timing mechanics can be expanded in Phase 3

---

## Document Version
**Version:** 2.5 - SAVE SYSTEM & END STATE PHILOSOPHY
**Date:** 29/12/2024
**Status:** ✅ FINALIZED - Complete & Production-Ready Design

## Changelog

### Version 2.5 (29/12/2024) - SAVE SYSTEM & END STATE PHILOSOPHY
**Save System Comprehensive Specification Added:**
- **Save Restrictions:** Player must manually disconnect all networks + complete all operations
- **No Edge Cases:** Clean state required (no clipboard, no active connections, no progress bars)
- **Save Button UI:** Greyed out with helpful tooltips explaining what's blocking save
- **Single Save State Decision:** Documented with performance analysis
  - Complete save structure defined (all game state in one JSON object)
  - Size estimates: 150-300 KB for Phase 2-3 (well within localStorage 5-10 MB limit)
  - Performance: <20ms save/load (imperceptible)
  - Justification: Simplicity, atomicity, adequate performance for Phase 2-4 scale
  - Split storage deferred until Phase 5+ if needed (messages exceed 500+)
- **Implementation Examples:** Save/load functions with version checking, timer resumption, interest restart
- **State Structure:** Complete example showing messages, transactions, missions, NAR, timers, UI state

**Phase 2 End State Philosophy Documented:**
- **Development Milestone:** Phases organize dev work, not player achievements
- **No Victory Condition:** Intentionally open-ended (player decides when done)
- **Variable End States:** All valid (-6k struggling to +50k grinding)
- **"Boring" Is Intentional:** Repetitive missions validate systems, not final game
- **Clean for Phase 3:** No loose ends, all systems self-contained
- **Manager Acknowledgment:** Simple message when breaking even (no celebration)
- **Storage Not a Concern:** 14.5 GB / 90 GB used (Phase 3 adds management)
- **Phase 3 Ready:** Hardware purchasing, new missions, additional OS, message deletion all ready to enable

**Additional Clarifications:**
- Active mission state saved (player can save mid-mission if no operations active)
- Transactions include interest charges (every minute when overdrawn)
- NAR entries persist with "Expired" status after mission completion
- No clipboard/network/operation state saved (enforced by save restrictions)

### Version 2.4 (29/12/2024) - FINAL CORRECTIONS & POLISH
**UI Enhancements:**
- **Active Mission Indicator:** Added to top bar (shows incomplete objectives count, hover shows all objectives with completion status)
- **Network Credential Expiration:** Auto-expire after mission completes, NAR entries show "Expired" status
- **Transaction History Color Coding:** Green for income, red for expenses
- **Transaction Notifications:** All transactions trigger banking notification (not just large amounts)

**Phase 2 Scope Corrections:**
- Fixed all Mission Board "pre-installed" references → requires license from manager
- Removed weekly banking summary (not needed)
- Removed Portal notifications (Phase 2 has none)
- Confirmed message deletion NOT in Phase 2 (same as Phase 1 - archive only)

**Game Balance Sections Rewritten:**
- **Starting Economy:** Now reflects tutorial free licenses ($1,600 value), -8k debt after tutorial
- **Early Game Progression:** Removed hardware references, focus on debt recovery through missions
- **Software in Phase 2:** Clarified no additional software purchases needed (tutorial provides all tools)
- Removed: Hardware Upgrade Path, Software Unlock Progression (not applicable to Phase 2)

**Application Tests Updated:**
- Removed Password Cracker (not in Phase 2)
- Added Network Address Register tests
- Updated File Manager tests (corruption detection, copy/paste)
- Updated Mission Board tests (automatic completion, reputation gating)
- Updated VPN Client tests (multiple connections, NAR integration)

**JSON Syntax Fixed:**
- Phase 1 conversion JSON now valid (removed orphaned quote)

### Version 2.3 (29/12/2024) - ARCHITECTURAL IMPROVEMENTS & CORRECTIONS
**Architectural Refinements:**

**Core System Messages (Separation of Concerns):**
- **Banking System:** Now handles own messages (overdraft, bankruptcy warnings)
  - Triggered by `creditsChanged` event, not story missions
  - Removes bank overdraft from tutorial mission JSON
  - Banking logic stays in BankingSystem.js
- **Reputation System:** Now handles own messages (performance warnings, termination)
  - Triggered by `reputationChanged` event
  - HR messages in ReputationSystem.js
- **Benefits:** Systems independent, story missions simplified, easier testing

**Phase 1 Event Conversion Plan:**
- **Migrate:** Phase 1 hardcoded messages → story event JSON
- **File:** `src/missions/data/phase1-welcome.json`
- **Events:** HR welcome (2s after desktop), Manager welcome (2s after HR read)
- **Backward Compatible:** Same player experience, cleaner architecture
- **Integration:** Phase 1 events chain to Phase 2 via trigger system

**Pricing Corrections:**
- Fixed all software $0 references → actual prices
- Mission Board: $250, NAR: $200, Scanner: $300, File Manager: $350, VPN: $500
- Total free license value: $1,600
- Portal displays price + "Licensed" for all software

**Hardware References Removed:**
- Overview, E2E tests, completion criteria updated
- All hardware purchasing clarified as Phase 3+

### Version 2.2 (29/12/2024) - ARCHITECTURAL SYSTEMS ADDED
**Critical Additions for Maintainability & Testing:**

**Story Mission System Architecture:**
- **Data-Driven Design:** Story missions defined in JSON, separate from core code
- **Trigger Event System:** Core game emits events, story missions subscribe
- **Objective Tracker:** Monitors completion conditions, updates mission state
- **Scripted Event Executor:** Handles sabotage events, forced disconnects, visual effects
- **Benefits:**
  - Add new missions without changing core gameplay code
  - Test trigger system independently from story content
  - Clear separation of concerns (core vs. story)
  - Future: Mission editor tool, community mods
- **File Structure:** `src/missions/data/` contains all story mission JSON definitions
- **Testing Strategy:** Unit tests for triggers, integration for flow, E2E for experience

**Debug System Architecture:**
- **Development Mode Only:** `Ctrl+Shift+D` or `?debug=true`
- **5-Tab Debug Panel:**
  1. Game State (credits, reputation, time)
  2. Missions (trigger, complete, fail)
  3. Software (instant install/uninstall)
  4. Networks (add, connect, simulate)
  5. Scenarios (9 pre-configured states)
- **Scenario Presets:**
  - Fresh Start, Tutorial Start, Tutorial Failed
  - Post-Tutorial, Mid-Game, Out of Debt
  - High Performer, Near Bankruptcy, Near Termination
- **Testing Integration:** Helpers for Vitest and Playwright
- **Benefits:**
  - Test advanced features without playing through tutorial
  - Reproduce edge cases instantly (bankruptcy, termination)
  - Automated tests run much faster
  - Manual QA significantly streamlined

**Phase 2 Completion Updated:**
- Story Mission System must be implemented and tested (90%+ coverage)
- Debug System must be functional for all scenarios
- Essential for managing complexity of Phase 2 features

### Version 2.1 (29/12/2024) - FINAL REFINEMENT & SIMPLIFICATION
**Critical Scope Changes:**
- **Hardware Purchasing:** REMOVED from Phase 2 (Phase 3+ only)
- **Software Only:** Phase 2 focuses exclusively on software purchasing
- **Mission Types:** Simplified to file restoration & file repair only (no password cracking)
- **Mission Completion:** Now AUTOMATIC (no manual submit button)

**New Systems Added:**
- **Software Storage System:** All software consumes SSD space
  - OSNet OS takes 10-15 GB base storage
  - Each app shows required space in Portal
  - App launcher displays "X GB used / Y GB free" at bottom
- **Network Bandwidth Sharing:** Multiple actions share bandwidth equally
  - Downloads + file copying share available bandwidth
  - Always can connect/download, just slower when shared
  - Example: 50 Mbps connection split between 2 actions = 25 Mbps each

**Mission Board Acquisition Updated:**
- **NOT pre-installed** - license sent 20 seconds after Phase 1 manager welcome
- Manager message explains: click attachment → portal → install
- Only after Mission Board installed can tutorial mission begin
- Tutorial mission message then includes other software licenses

**Portal Software Display:**
- **ALL software shows pricing** - even free-licensed software displays price
- Licensed software shows: "Price: $X | Storage: Y MB | Licensed"
- Button changes: "Purchase" → "Install" for licensed software
- Example: VPN Client shows $500 price even though player has free license

**Network Address Register Changes:**
- **Entries NOT automatic** - must click attachment to add
- Mission messages include NAR entry attachments
- Click entry in NAR → opens VPN Client with network pre-selected
- VPN Client lists all connected networks, allows individual disconnection
- Top bar network icon also shows list + disconnect options

**Reputation System Enhanced:**
- **Mission Gating:** Client types based on reputation (Banks need high rep, Libraries/Museums lenient)
- **Payout Scaling:** Reputation multiplier affects earnings (0.5x to 2.0x)
- **Warning System:** "On Performance Plan" (Tier 2) triggers warning message
- **Final Warning:** "Should be let go" (Tier 1) = 10-minute timer to complete mission or FIRED
- **Mission Board:** Shows out-of-range missions greyed out (motivates improvement)

**Bankruptcy System Enhanced:**
- **Audio:** Chime every second once countdown hits 10 seconds (intense final warning)
- **Game Over Message:** "SourceNet has been notified... bank worked with SourceNet to seize assets..."

**File Manager Updates:**
- **Visual Corruption Indicators:** Red warning icon (⚠) + red text color for corrupted files
- **Automatic Detection:** Corruption detected when directory loads
- **Repair Button:** Only enabled when corrupted files selected

**Tutorial Flow Completely Revised:**
- **Part 1 Has Consequences:** Tutorial failure costs reputation + credits (not consequence-free)
- **Automatic Completion:** Both parts auto-complete after objectives (no submit button)
- **Mission Board License:** Separate message 20s after Phase 1 welcome
- **Software Licenses:** Sent after player accepts tutorial mission
- **Network Entry Attachment:** Must click to add to NAR

**Mission Completion System:**
- **All missions:** Auto-complete few moments after objectives finish
- **Status:** "Mission Completing..." → "Verifying with client..." → SUCCESS/FAILED
- **No Submit Button:** Completion entirely automatic
- **Credits:** Awarded/deducted automatically

**Phase 2 Mission Types (Simplified):**
- Type 1: File Backup (copy files)
- Type 2: File Repair (fix corrupted files)
- Type 3: File Restoration (restore from backups)
- Type 4: Combined Tasks (multi-step file operations)
- **Removed:** Password cracking, vulnerability scanning, encryption breaking (Phase 3+)

### Version 2.0 (29/12/2024) - COMPREHENSIVE REFINEMENT
**Major Changes:**

**New Game Systems:**
- **Reputation System** (11-tier): Track player performance, gate missions by skill level
  - Starts at Superb (Tier 9), drops to Accident Prone (Tier 3) after tutorial failure
  - Color-coded display in top bar with hover tooltips
  - Affects mission availability
- **Bankruptcy System**: Financial pressure with game-over consequences
  - Overdraft allowed with 1% per minute interest (affected by time speed)
  - Bankruptcy trigger: >10k overdrawn for 5 consecutive minutes
  - 5-minute countdown with red flashing warning banner
  - Game over: Asset seizure by financial authorities
- **Software Attachment System**: Messages can include free software licenses
  - Attachments add licenses to Portal account
  - Player downloads/installs from Portal (not instant)
  - Tutorial provides 4 apps free (VPN, Network Address Register, Network Scanner, File Manager)

**New Applications:**
- **Network Address Register**: Manages network connections and credentials
  - Mission messages auto-add network entries
  - VPN Client reads from this to show available networks
- **File Manager**: Access and manipulate files on networked file systems
  - One connection per instance, multiple instances supported
  - Copy/paste mechanism works across instances
  - Corruption detection and repair
  - Disconnection handling with overlay
- **Network Scanner** (Refined): Scan connected networks for machines/file systems
  - Dropdown to select which connected network to scan
  - Time-based discovery (some machines only discoverable at certain times)
  - Deep scan finds file systems

**Tutorial Redesign - 2-Part Narrative:**
- **Part 1: "Log File Repair"** (Intentional Failure)
  - Player repairs files successfully
  - Mystery actor deletes files (scripted sabotage)
  - VPN forcibly disconnected
  - Mission fails: -10,000 credit penalty → Balance: -9,000
  - Reputation drops: Superb → Accident Prone (-6 tiers)
  - Manager angry message, Bank overdraft notice
  - Creates dramatic tension and urgency
- **Part 2: "Log File Restoration"** (Recovery)
  - Simple file copy mission
  - Teaches multiple File Manager instances
  - Success: +1,000 credits → Balance: -8,000
  - Still in debt, must work to recover
  - Manager: "Work until back in the black"
- **Emotional Arc**: Confidence → Shock → Panic → Recovery → Determination

**UI Updates:**
- **Network Connection Indicator** (top bar): Shows active connection count, hover to see/disconnect
- **Reputation Display** (top bar): Color-coded icon with tier number
- **Bankruptcy Warning Banner**: Red flashing countdown when triggered
- No notification icon for Mission Board (it's a core app, not event-driven)

**Post-Tutorial Mission Pool:**
- 4 mission types: File Backup, File Repair, File Restoration, Combined Tasks
- Reputation gates harder missions
- No retries on failed missions (permanent)
- Failure consequences: Credit loss + reputation loss
- Player needs 8-10 missions to recover from -8k debt

**Design Decisions Finalized:**
- Mission Board as SourceNet-branded app (license from manager, not pre-installed)
- Simple failure only during tutorial; real missions have consequences
- Hardware affects performance (speed), not mission gating
- Tiered payments reward faster completion
- Mission cooldowns based on difficulty
- Downloads pause with game pause
- No software dependencies, single bank account
- Tutorial includes intentional failure to teach consequences

### Version 1.1 (28/12/2024) - INITIAL FINALIZATION
- All design decisions made and documented
- Tutorial approach clarified: 2-3 sequential missions, add types iteratively
- Hardware impact system designed: Performance-based (not gating), tiered payments
- Mission cooldown system defined: Difficulty-based cooldowns
- Simple failure system with immediate retry
- Mission Board as core app (no notifications)
- Save system extension plan documented
- No software dependencies, no multiple bank accounts (Phase 2)
- Downloads pause with game pause

### Version 1.0 (28/12/2024) - INITIAL DRAFT
- Initial Phase 2 design specification created
- Core systems designed: Missions, Purchasing, Installation, Applications
- Tutorial mission fully detailed
- Game balance and progression defined

---

## Design Decisions - Finalized

### 1. Mission Variety & Approach
**Decision:** Start with tutorial mission only, add additional mission types iteratively during Phase 2 development
- **Rationale:** Allows for rapid iteration and testing of core systems before expanding
- **Implementation:** 2-3 sequential tutorial missions teach Phase 2 concepts progressively
- **Future:** Add mission types one at a time, test thoroughly, then add next type

### 2. Hardware Requirements for Missions
**Decision:** Hardware affects performance/speed, NOT mission unlocking
- **Rationale:**
  - CPU/RAM make missions faster (password cracking), not required to start them
  - Better hardware = faster completion = higher tiered payout
  - Storage (SSD space) may be required for file-copying missions (future feature)
  - Avoids hard-gating missions behind expensive upgrades
- **Implementation:** Tiered payment system rewards faster completion (Standard/Fast/Exceptional)

### 3. Mission Cooldowns
**Decision:** Mission-specific cooldowns based on difficulty
- **Easy Missions:** No cooldown - chain immediately
- **Medium Missions:** 10-15 game minutes cooldown
- **Hard Missions:** 30-45 game minutes cooldown
- **Rationale:** Prevents farming high-payout missions, encourages varied gameplay and progression

### 4. Mission Failure System
**Decision:** Yes - Simple failure conditions with immediate retry allowed
- **Failure Triggers:** Wrong password after 3 attempts, VPN disconnect during critical steps
- **No Consequences:** No reputation loss, credit penalty, or mission lockout in Phase 2
- **Rationale:** Teaches correct approach without punishment, maintains friendly learning environment

### 5. Download Control & Game Pause
**Decision:** Pause game = pause downloads
- **Implementation:** Downloads stop when game paused/closed, resume when unpaused/loaded
- **Rationale:** Simple, consistent with game time system, avoids complex background processing

### 6. Installation During Missions
**Decision:** Yes - Always allowed (both software and hardware)
- **Rationale:** Useful if player realizes mid-mission they need a tool
- **Note:** Hardware requires reboot, but player can delay reboot until after mission

### 7. Multiple Bank Accounts
**Decision:** No - Single account only (First Bank Ltd)
- **Rationale:** Simplifies Phase 2, no clear benefit yet for multiple accounts
- **Future:** Can add in Phase 3 if compelling gameplay reason emerges

### 8. Save System Updates
**Decision:** Extend current system with new state properties
- **New State to Save:**
  - Active mission data (current objectives, progress)
  - Download queue (items, progress %)
  - Completed missions history
  - Mission cooldown timers
- **Rationale:** Current architecture designed to handle additional state, no restructure needed

### 9. Software Dependencies
**Decision:** No - Keep all software independent
- **Rationale:** Simpler to understand and manage, avoids dependency complexity
- **Future:** Could add bundles/suites in later phases if desired

### 10. Mission Board Notifications
**Decision:** NO notifications for Mission Board
- **Implementation:** Mission Board requires license from manager (installed via Portal after license received)
- **Player Behavior:** Player checks Mission Board actively to find missions
- **Rationale:** Missions are player-initiated, not event-driven like mail/banking
- **UI:** No notification icon in top bar for Mission Board
