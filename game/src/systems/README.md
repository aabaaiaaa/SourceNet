# Game Systems Architecture

## Overview

Game systems are core gameplay mechanics that operate independently but coordinate through the trigger event bus. Each system manages its own state and emits/subscribes to relevant game events.

## Core Systems

### ReputationSystem.js

**Purpose:** Track player performance and affect gameplay

**Key Features:**
- 11 reputation tiers (from "Should be let go" to "Star employee")
- Payout multipliers (0.5x to 2.0x based on tier)
- Client type gating (Banks need high rep, Libraries/Museums more lenient)
- Warning system (Tier 2 triggers performance plan warning)
- Game over condition (Tier 1 = 10-minute countdown to termination)

**Events Emitted:**
- `reputationChanged` - When tier changes

**Events Consumed:**
- `missionComplete` - Updates reputation based on success/failure

**Functions:**
```javascript
getReputationTier(tier)               // Get tier information
calculatePayoutWithReputation(base, tier)  // Apply multiplier
canAccessMission(clientType, tier)    // Check client type access
calculateReputationChange(success, currentTier)  // Calculate new tier
getReputationWarning(oldTier, newTier)  // Check if warning needed
startReputationCountdown(time)        // Start 10-min countdown
updateReputationCountdown(countdown, time)  // Update countdown
```

### BankingSystem.js

**Purpose:** Manage credits, overdraft, and bankruptcy

**Key Features:**
- Overdraft allowed (negative balances)
- Interest: 1% per minute when overdrawn (affected by time speed)
- Bankruptcy trigger: >10k overdrawn for 5 consecutive minutes
- Transaction tracking (income/expense with color coding)
- System messages (overdraft notice, bankruptcy warnings)

**Events Emitted:**
- `creditsChanged` - When credits change

**Events Consumed:**
- `missionComplete` - Award/deduct credits
- `softwarePurchased` - Deduct purchase cost

**Functions:**
```javascript
calculateInterest(balance)            // 1% of negative balance
shouldTriggerBankruptcy(balance)      // Check if < -10k
startBankruptcyCountdown(time)        // Start 5-min countdown
updateBankruptcyCountdown(countdown, time, balance)  // Update countdown
getBankruptcyAudioWarning(remaining, previous)  // Check if audio needed
getBankingMessageType(newBalance, oldBalance, countdown)  // Determine message
createTransaction(type, amount, desc, balance, time)  // Create transaction record
getTotalCredits(accounts)             // Sum across accounts
```

### MissionSystem.js

**Purpose:** Manage mission lifecycle and requirements

**Key Features:**
- Mission acceptance validation (software, reputation requirements)
- Objective tracking (pending → complete)
- Automatic completion (after all objectives)
- Mission cooldowns (Easy: 0min, Medium: 10-15min, Hard: 30-45min)
- Payout calculation with reputation multipliers

**Events Emitted:**
- `missionAccepted` - When player accepts mission
- `missionComplete` - When mission finishes
- `objectiveComplete` - When objective completed

**Events Consumed:**
- Various game events for objective completion

**Functions:**
```javascript
canAcceptMission(mission, software, rep, active)  // Validate requirements
initializeMissionObjectives(defs)     // Create objective objects
areAllObjectivesComplete(objectives)  // Check completion
hasFailedObjective(objectives)        // Check failures
updateObjectiveStatus(objectives, id, status)  // Update objective
calculateCooldownEndTime(difficulty, time)  // Calculate cooldown
isCooldownExpired(endTime, currentTime)  // Check cooldown
calculateMissionPayout(base, reputation)  // Apply rep multiplier
calculateMissionDuration(start, end)  // Mission time
createCompletedMission(mission, status, payout, rep, time, duration)  // Record
```

## System Integration Pattern

### 1. Event-Driven Communication

Systems communicate via trigger event bus:

```javascript
// System A emits event
triggerEventBus.emit('creditsChanged', {
  oldBalance: 1000,
  newBalance: -8000,
  change: -9000,
});

// System B subscribes and reacts
triggerEventBus.on('creditsChanged', (data) => {
  if (data.newBalance < 0) {
    sendOverdraftMessage();
  }
});
```

### 2. State in GameContext

All system state lives in GameContext:

```javascript
// Reputation state
const [reputation, setReputation] = useState(9);
const [reputationCountdown, setReputationCountdown] = useState(null);

// Banking state
const [transactions, setTransactions] = useState([]);
const [bankruptcyCountdown, setBankruptcyCountdown] = useState(null);

// Mission state
const [activeMission, setActiveMission] = useState(null);
const [completedMissions, setCompletedMissions] = useState([]);
```

### 3. Actions Exported via Context

GameContext provides action functions:

```javascript
const value = {
  // State
  reputation,
  transactions,
  activeMission,

  // Actions
  acceptMission,
  completeMission,
  completeMissionObjective,
};
```

### 4. Components Consume via useGame()

```javascript
const MissionBoard = () => {
  const { activeMission, acceptMission, reputation } = useGame();

  const handleAccept = (mission) => {
    acceptMission(mission);
  };

  return <div>...</div>;
};
```

## System Message Flow

### Banking Messages (Automatic)

```javascript
// In BankingSystem or GameContext
useEffect(() => {
  const totalCredits = getTotalCredits();

  if (totalCredits < 0 && previousCredits >= 0) {
    // First overdraft
    sendSystemMessage('bank', 'firstOverdraft', { balance: totalCredits });
  }

  if (totalCredits < -10000) {
    // Start bankruptcy countdown
    setBankruptcyCountdown(startBankruptcyCountdown(currentTime));
  }
}, [totalCredits]);
```

### Reputation Messages (Automatic)

```javascript
// When reputation changes
useEffect(() => {
  const warning = getReputationWarning(oldReputation, reputation);

  if (warning === 'performance-plan') {
    sendSystemMessage('hr', 'performancePlanWarning', { tier: reputation });
  }

  if (warning === 'final-termination') {
    setReputationCountdown(startReputationCountdown(currentTime));
    sendSystemMessage('hr', 'finalTerminationWarning', { tier: reputation });
  }
}, [reputation]);
```

## Testing Strategy

### Unit Tests
Test individual system functions in isolation:
- ReputationSystem.test.js (32 tests)
- BankingSystem.test.js (34 tests)
- MissionSystem.test.js (27 tests)

### Integration Tests
Test system interactions:
- mission-state-persistence.test.jsx (save/load)
- Future: reputation-banking-interaction.test.jsx
- Future: mission-completion-flow.test.jsx

### E2E Tests
Test complete user flows:
- Future: tutorial-part-1.spec.js
- Future: bankruptcy-game-over.spec.js
- Future: reputation-termination.spec.js

## Adding New Systems

1. **Create system file** in `src/systems/`
2. **Add state to GameContext** if needed
3. **Subscribe to events** via triggerEventBus
4. **Emit events** when state changes
5. **Export functions** for use by components
6. **Write tests** (unit + integration)

## Best Practices

- **Pure functions:** System logic should be testable without React
- **Event-driven:** Use trigger bus for cross-system communication
- **Single responsibility:** Each system manages one aspect of gameplay
- **Avoid direct coupling:** Systems shouldn't import each other
- **Comprehensive testing:** 90%+ coverage on all functions

## Current Systems Status

✅ **ReputationSystem** - Complete, tested (32 tests)
✅ **BankingSystem** - Complete, tested (34 tests)
✅ **MissionSystem** - Complete, tested (27 tests)
⏳ **PurchasingSystem** - Framework ready, needs implementation
⏳ **InstallationSystem** - Framework ready, needs implementation

## Future Systems (Phase 3+)

- **HardwareSystem** - Hardware purchasing and installation
- **SkillSystem** - Player skills and upgrades
- **NetworkSystem** - Network simulation and bandwidth
- **SecuritySystem** - Intrusion detection, countermeasures
