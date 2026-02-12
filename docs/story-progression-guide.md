# Story Progression & Narrative Guide

## 1. Story Overview & Themes

SourceNet is a cybersecurity contractor simulation where the player operates a remote terminal, taking on missions from clients through a corporate intermediary called SourceNet. The player connects to client networks, navigates file systems, repairs corrupted data, investigates incidents, and recovers from attacks — all while managing their finances and professional reputation. The story is told entirely through in-game emails, mission briefings, and scripted events that unfold as the player progresses.

### Core Narrative Themes

- **Learning through failure.** The player's very first real mission ends in scripted sabotage and catastrophic failure. This teaches the stakes before the player has earned anything.
- **Recovery and redemption.** After the tutorial disaster, the entire early game is about digging out of debt and rebuilding a ruined reputation. Every small success matters.
- **Escalating stakes.** Missions progress from basic file copying to investigating data theft to combating live ransomware attacks on the player's own terminal.
- **Economic pressure.** Credits are tight. The player starts at -9,000 after the tutorial failure and must grind back to solvency before better work opens up. Bankruptcy is an explicit threat.

### The Manager

The manager is the player's anchor character — the only persistent voice throughout the game. They shift tone across phases: encouraging during onboarding, harsh after the tutorial failure, measured during the grind, impressed after the first investigation, and panicked when the player's terminal comes under attack. The manager delivers tool unlocks as narrative moments, hints at future content through casual remarks, and provides the emotional throughline that connects mechanical progression to story.

---

## 2. Complete Story Timeline

### Phase 1: Onboarding

The onboarding sequence introduces the player to their terminal, their employer, and their manager through a chain of timed messages. No missions are available yet — the player is just getting oriented.

**Trigger chain:**

1. `newGameStarted` event fires when the player reaches the desktop for the first time.
2. **HR Welcome** (`msg-welcome-hr`) — arrives 2 seconds after `newGameStarted`.
   - From: SourceNet Human Resources
   - Introduces SourceNet's mission ("securing the global internet space from dark actors and criminals")
   - Points the player to the OSNet Portal for software/hardware upgrades
   - No attachments
3. **Manager Welcome** (`msg-welcome-manager`) — arrives 2 seconds after the player reads the HR message.
   - From: SourceNet Manager {managerName}
   - Warm, personal introduction ("I was present during your interview process")
   - Attachment: **1,000 credit welcome cheque**
   - Player deposits the cheque to start with 1,000 credits
4. **Mission Board License** (`mission-board-license`) — arrives 20 seconds after the player reads the manager welcome.
   - From: SourceNet Manager {managerName}
   - Subject: "Get Ready for Your First Mission"
   - Attachment: **Mission Board software license** (value: 250 credits)
   - Instructs the player to install the Mission Board from the Portal
5. **Software Licenses** (`tutorial-software-licenses`) — arrives 5 seconds after the player reads the Mission Board message AND installs the Mission Board.
   - From: SourceNet Manager {managerName}
   - Subject: "Mission Software"
   - Attachments: **4 software licenses** (total value: 1,350 credits):
     - SourceNet VPN Client (500 credits)
     - Network Address Register (200 credits)
     - Network Scanner (300 credits)
     - File Manager (350 credits)
   - Detailed step-by-step instructions for the first mission

**Source files:** `src/missions/data/welcome-messages.json`, `src/missions/data/mission-board-intro.json`

---

### Phase 2: Tutorial (The Trap)

The tutorial is a two-part sequence designed to teach through consequence. Part 1 always ends in scripted failure. Part 2 is a deliberately simple recovery that gets the player back on their feet.

#### Tutorial Part 1: Log File Repair

- **Mission ID:** `tutorial-part-1`
- **Client:** Client A — TechCorp Industries
- **Trigger:** Available immediately once Mission Board is installed (0ms delay after `softwareInstalled` event for `mission-board`)
- **Payout (if success):** 2,000 credits (unreachable — mission always fails)
- **Network:** ClientA-Corporate (`192.168.50.0/24`, bandwidth: 50)

**Objectives:**
1. Add ClientA-Corporate credentials to NAR
2. Connect to ClientA-Corporate network
3. Scan network to find `fileserver-01` (`192.168.50.10`)
4. Connect File Manager to `fileserver-01`
5. Repair all 8 corrupted log files (`log_2024_01.txt` through `log_2024_08.txt`)

**The sabotage:** 5 seconds after the player repairs the last file, a scripted event fires:

1. **Force file deletion** — all 8 repaired files are deleted with a 15-second progress bar. The player cannot stop this.
2. **Forced disconnect** — the network administrator terminates the connection with the message: "Intrusion detected. Unauthorized file deletion activity flagged."
3. **NAR revocation** — the ClientA-Corporate NAR entry is permanently invalidated.
4. **Mission failure** — the mission is marked as failed with reason "Files deleted instead of repaired."

**Failure consequences:**
- **-10,000 credits** (player goes from ~1,000 to ~-9,000)
- **-6 reputation** (crashes from starting "Superb" to "Accident Prone")
- **Manager message** (`tutorial-1-failure`): 10-second delay, subject "What happened?!"
  - Furious tone: "I was monitoring your mission and I saw you DELETE all the log files"
  - Explains NAR revocation mechanics
  - Introduces bankruptcy threat: "If you're overdrawn by more than 10,000 credits for 5 minutes, the financial authorities will seize your assets"
  - Bank overdraft warning is also triggered by the Banking System independently

**Design intent:** The player did everything right, but the system framed them. This establishes that the game world is not safe, that network administrators have power over you, and that financial consequences are real. The player has no way to avoid this failure — it's scripted to happen regardless of how carefully they play.

**Source files:** `src/missions/data/tutorial-part-1.json`, `messageTemplates.js` (`tutorial-1-failure`)

---

#### Tutorial Part 2: Log File Restoration

- **Mission ID:** `tutorial-part-2`
- **Client:** Client A — TechCorp Industries
- **Trigger:** 30 seconds after `tutorial-part-1` completes (fires on `missionComplete` event)
- **Payout:** 1,000 credits
- **Network:** ClientA-Corporate (re-authorized, same address range but different file system layout)

**Pre-mission intro message** (`tutorial-2-intro`): Sent immediately when tutorial-part-2 activates.
- Subject: "Let's try something simpler"
- Sympathetic but firm: "I know that was rough... just copy files from one location to another. No repairing, no deleting, just copying."
- Mentions that more basic missions are available after this one
- Sets expectation: "Once you're out of debt, I'll reach out again with better work."

**Objectives:**
1. Reconnect to ClientA-Corporate network
2. Scan network to find both file systems (find `backup-server` at `192.168.50.20`)
3. Connect first File Manager to `backup-server`
4. Connect second File Manager to `fileserver-01` (now empty)
5. Copy all 8 log files from `backup-server` to `fileserver-01`

**Success consequences:**
- **+1,000 credits** (player goes from ~-9,000 to ~-8,000)
- Two follow-up messages:
  1. **"Better"** (`tutorial-2-success`) — 5-second delay
     - Acknowledges recovery: "Simple task, executed correctly"
     - States debt position: "still deep in debt (-8,000 credits)"
     - Points to Mission Board for more work
     - Notes reputation is still "Accident Prone"
  2. **"About Network Access"** (`tutorial-2-nar-info`) — 15-second delay
     - Explains that mission network credentials are always temporary
     - Normalises NAR revocation as standard procedure

**Follow-up:** Success triggers `post-tutorial-pool` — procedural missions become available.

**Design intent:** This mission is intentionally trivial. After the traumatic tutorial-part-1, the player needs a win. Copy-only, no traps, no tricks. The low payout (1,000) reinforces that recovery will take time.

**Source files:** `src/missions/data/tutorial-part-2.json`, `messageTemplates.js` (`tutorial-2-intro`, `tutorial-2-success`, `tutorial-2-nar-info`)

---

### Phase 3: Grinding Out of Debt

After tutorial-part-2 succeeds, the player enters the grind phase. Procedural missions become available when the player reads the "Better" message (`msg-manager-better`).

**What happens when "Better" is read:**
1. `setBetterMessageRead(true)` — enables the hardware unlock trigger
2. `setProceduralMissionsEnabled(true)` — activates the procedural mission pool
3. The mission pool is initialised with 4-6 basic file repair/backup/transfer jobs

**Player's financial journey:**
- Start of grind: ~-8,000 credits
- Goal: reach +1,000 credits (hardware unlock threshold)
- Missions pay 500-2,000 credits each depending on complexity
- Some missions have mid-mission extensions that add objectives and increase payout

**"Back in the Black" message** (`back-in-black`): When the player's balance first reaches 0+, this message is sent.
- Brief encouragement: "Good work. You're out of debt."
- Hints at better opportunities ahead

**Hardware unlock gate:** When the player's balance reaches **1,000 credits** AND `betterMessageRead` is true:
1. The `creditsChanged` event fires
2. GameContext schedules the **hardware-unlock message** with a 3-second delay
3. Message subject: "New Opportunities - Hardware & Tools"
4. Content introduces three concepts:
   - **Network adapters** (hardware) — require reboot to take effect, increase file transfer speed
   - **Log Viewer** (software) — view network access logs, see who did what
   - **Data Recovery Tool** (software) — recover deleted files, or securely delete files permanently
5. Features are unlocked in the Portal **when the player reads this message**, not when it's sent

**Source files:** `messageTemplates.js` (`hardware-unlock`, `back-in-black`), `GameContext.jsx` (lines ~972-1006 for hardware unlock trigger, lines ~321-336 for "Better" message tracking)

---

### Phase 4: Investigation

Investigation missions unlock through a tool-based gate: both Log Viewer AND Data Recovery Tool must be installed.

#### Investigation Intro Message

- **Trigger:** 5 seconds after both `log-viewer` AND `data-recovery-tool` are installed (conditions checked via `softwareInstalled` event + game state)
- **From:** SourceNet Manager
- **Subject:** "Investigative Work Available"
- Explains how investigations differ from basic file work
- Describes the two new tools and their uses
- Teases the first case: "A local library had some files go missing from their archives"

**Source file:** `src/missions/data/investigation-intro.json`

#### Data Detective: The Missing Archives

- **Mission ID:** `data-detective`
- **Client:** Westbrook Public Library
- **Difficulty:** Medium
- **Trigger:** 3 seconds after the player reads the investigation intro message (`msg-investigative-jobs`)
- **Payout:** 3,500 credits + 1 reputation
- **Network:** Westbrook Library (`172.20.0.0/24`, bandwidth: 100)

**Network layout:** 8 file systems across the library network:
- `main-catalog` (172.20.0.10) — library catalog, patron records
- `circulation` (172.20.0.11) — holds, overdue notices, staff schedules
- `periodicals` (172.20.0.12) — newspaper indices, magazine catalog; **2 deleted files**
- `reference` (172.20.0.13) — encyclopedias, research guides
- `archives-general` (172.20.0.20) — city records, genealogy, historical maps
- `archives-special` (172.20.0.21) — **the crime scene**; 4 deleted files + access logs
- `media-server` (172.20.0.30) — audiobooks, DVDs, streaming
- `admin-server` (172.20.0.50) — budget, staff directory, intern records

**Required objectives:**
1. Add Westbrook Library credentials to NAR
2. Connect to Westbrook Library network
3. Scan network, locate `archives-special`
4. Connect Data Recovery Tool to `archives-special` (172.20.0.21)
5. Scan `archives-special` for deleted files
6. Recover 4 Special Collection files:
   - `founders-correspondence-1885.pdf`
   - `original-charter-scan.tiff`
   - `historical-photos-collection.zip`
   - `first-edition-catalog.json`
7. View `archives-special` logs to identify the culprit

**Optional bonus objectives (+500 credits total):**
8. Scan `periodicals` for deleted files (+250 credits)
9. Recover 2 periodicals files: `local-gazette-archives.pdf`, `historical-photos-index.json` (+250 credits)

**The logs tell the story:** `archives-special` has detailed logs showing:
- `jthompson_intern` logged in remotely from `192.168.1.45`
- Accessed `rare-manuscripts-catalog.json`
- Deleted all 4 Special Collection files in sequence
- Logged out
- Later, `m_henderson` logged in locally, accessed `donation-records.xlsx`, logged out (innocent activity)

**Trap:** If the player secure-deletes any of the 4 critical archive files, the mission immediately fails with the reason: "Critical archive file was permanently destroyed. The library needed these files recovered, not deleted forever."

**Failure handling:** -2,000 credits, -2 reputation, **retryable** after 60 seconds. Failure message (`investigation-failure-retry`) explains the mistake and offers another chance.

**Success consequences:**
- +3,500 credits, +1 reputation
- Message (`investigation-intro-success`) — 5-second delay:
  - Subject: "Excellent Work - Investigation Missions Unlocked"
  - Opens investigation missions in the procedural pool
  - **The breadcrumb:** "I'm looking into getting you access to some advanced decryption tools. They're not cheap though. Keep taking contracts and building up your credits. Once you've earned another 10,000 or so, I should be able to sort something out."

**Source files:** `src/missions/data/data-detective.json`, `messageTemplates.js` (`investigation-intro-success`, `investigation-failure-retry`)

---

### Phase 5: Decryption & Ransomware

The decryption phase begins with a credit threshold mechanic and culminates in the game's capstone mission.

#### Decryption Threshold

When the player reads the "Investigation Missions Unlocked" message:
1. GameContext records the player's **current balance**
2. Sets `creditThresholdForDecryption` = current balance + 10,000
3. This threshold is persisted to save data

When the player's balance reaches the threshold:
1. The `creditsChanged` event fires
2. GameContext schedules the **decryption-tease message** (`msg-decryption-work`) with a 5-second delay
3. Message subject: "Decryption Work - Ready to Go"
4. Introduces the Decryption Tool (500 credits in the Portal, handles AES-128 and AES-256)
5. Teases the MetroLink mission: "Got hit by a ransomware attack last week and their ticketing systems are down"

**Source files:** `GameContext.jsx` (lines ~2117-2133 for threshold setting, lines ~1008-1045 for tease trigger), `messageTemplates.js` (`decryption-tease`)

#### Ransomware Recovery

- **Mission ID:** `ransomware-recovery`
- **Client:** MetroLink Transit Authority
- **Difficulty:** Hard
- **Trigger:** 3 seconds after the player reads the decryption-tease message (`msg-decryption-work`)
- **Payout:** 6,000 credits + 2 reputation
- **Required software:** Decryption Tool, VPN Client, Network Scanner, Data Recovery Tool, Log Viewer
- **Network:** MetroLink-Operations (`10.50.0.0/24`, bandwidth: 75)

**Network layout:** 2 file systems:
- `ticketing-db` (10.50.0.10) — encrypted ticketing database, fare tables, route schedules, **2 malware files**
- `scheduling-srv` (10.50.0.20) — encrypted crew roster, shift patterns, training records

**Ticketing server logs reveal the attack:**
- `unknown_0x4F2A` logged in from `185.243.115.42` (unauthorized)
- Uploaded `svchost32.exe` (45 KB) and `winupdate.dll` (32 KB) — malware
- Executed `svchost32.exe` (spawned PID 4092)
- SYSTEM encrypted `ticketing-database.db` → `ticketing-database.db.enc` (AES-256)
- Attacker disconnected

**Phase A — Core Recovery (objectives 1-9):**
1. Add MetroLink-Operations credentials to NAR
2. Connect to MetroLink-Operations network
3. Scan network, locate both `ticketing-db` and `scheduling-srv`
4. View `ticketing-db` logs to investigate the attack
5. Securely delete malware: `svchost32.exe` and `winupdate.dll`
6. Decrypt `ticketing-database.db.enc`
7. Upload decrypted `ticketing-database.db` to `ticketing-db`
8. Decrypt `crew-roster.db.enc`
9. Upload decrypted `crew-roster.db` to `scheduling-srv`

**Phase B — The Extension Trap:**

8 seconds after the player uploads the crew roster (objective `obj-upload-scheduling`):
1. A new message arrives from MetroLink: "One More File — Passenger Data"
   - Asks the player to decrypt `passenger-data.dat.enc` (2 MB) — "It should be straightforward"
2. The file is added to the `ticketing-db` file system
3. A new objective is added: "Decrypt passenger data file"

**Phase C — The Attack:**

2 seconds after the player decrypts the trap file:
1. **Ransomware overlay** triggers on the player's own terminal
   - Duration: 60 seconds, capacity: 90%
   - The player's screen is locked with an encryption progress overlay
2. 5 seconds later, the manager sends an **emergency message** (`ransomware-rescue`):
   - Subject: "EMERGENCY - Your Terminal Is Under Attack!"
   - "One of those files you decrypted was a planted virus disguised as passenger data!"
   - Attachment: **Advanced Firewall & Antivirus license** (value: 2,000 credits)
   - Urgency: "DO NOT WAIT. Every second counts."

**Resolution — Two Paths:**

**Path A: Install the Antivirus**
- Player installs Advanced Firewall & Antivirus from the Portal
- `passiveSoftwareStarted` event fires for `advanced-firewall-av`
- Scripted event pauses the ransomware and sends the resolution message (`ransomware-resolution`):
  - Subject: "Crisis Averted - Mission Update"
  - Explains the trap: "that 'passenger-data.dat' file was a planted trap — a ransomware payload disguised as encrypted data"
  - Confirms the earlier decryption work stands
  - Mission marked complete when player reads this message

**Path B: Manually Decrypt the Lock Screen**
- Player enters the decryption key on the ransomware overlay
- `ransomwareDecrypted` event fires on the event bus
- 3-second delay, then resolution message (`ransomware-decrypted-resolution`):
  - Subject: "How Are You Back Online?"
  - Manager is surprised and slightly suspicious: "I was told your workstation was completely locked down"
  - "Never mind, I don't need to know the details right now"
  - Notes the antivirus license is still available if the player wants it
  - Mission marked complete when player reads this message

**Success consequences (both paths):**
- +6,000 credits, +2 reputation
- Client thank-you message (`ransomware-recovery-success`) — 8-second delay:
  - From: MetroLink Transit Authority
  - Apologises for the secondary attack: "We had no idea the attackers had planted additional payloads"
  - Mentions a bonus for the additional risk

**Failure consequences:** -5,000 credits, -3 reputation, **not retryable**

**Source files:** `src/missions/data/ransomware-recovery.json`, `messageTemplates.js` (`ransomware-rescue`, `ransomware-resolution`, `ransomware-decrypted-resolution`, `ransomware-recovery-success`)

---

## 3. Character Voice Guide

### The Manager

The manager's tone shifts across phases, reflecting their evolving relationship with the player:

| Phase | Tone | Examples |
|-------|------|----------|
| Onboarding | Warm, encouraging | "I was present during your interview process and I have to say, you really impressed us" |
| Post-failure | Harsh, disappointed | "What just happened?! ... This is completely unacceptable" |
| Recovery intro | Sympathetic but firm | "I know that was rough... You can handle that, right?" |
| Grind | Measured, expectant | "Keep working." / "Good work. You're out of debt." |
| Hardware unlock | Professional, instructive | Detailed tool explanations, no hand-holding |
| Investigation success | Impressed, hinting | "Outstanding work" / "Once you've earned another 10,000 or so, I should be able to sort something out" |
| Decryption intro | Confident, raising stakes | "This is bigger money than the investigation work. Don't let me down." |
| Ransomware emergency | Panicked, urgent | "YOUR TERMINAL IS BEING ENCRYPTED!" / "DO NOT WAIT. Every second counts." |
| Post-antivirus rescue | Relieved, professional | "The antivirus caught it in time. Your terminal is clean." |
| Post-manual-decrypt | Surprised, wary | "Wait — your terminal is back online? ... How did you get back in?" |

**Key traits:**
- Always signs off with `- {managerName}`
- Uses the player's username directly, never "contractor" or "agent"
- Gets more personal as the story progresses (impersonal instructions → genuine concern)
- References specific events ("that first mission disaster", "the Westbrook Library case")

### Clients

**Corporate clients** (MetroLink, TechCorp): Formal, direct, slightly impersonal.
- "Dear SourceNet Contractor" (never the player's name in briefings)
- "Sincerely, [Title], [Organisation]"
- Focus on operational impact ("costing us tens of thousands of credits per day")

**Community clients** (Westbrook Library): Earnest, descriptive, slightly worried.
- "We have a sensitive situation... that requires discreet investigation"
- "These are irreplaceable historical records"
- "Please handle this matter with discretion"

### HR

Bureaucratic warmth — friendly but clearly templated.
- "Welcome to the family."
- "Your assigned manager will be contacting you shortly."

---

## 4. Progression Gates Reference Table

| Gate | Trigger Type | Condition | Unlocks |
|------|-------------|-----------|---------|
| HR welcome | Timer | 2s after `newGameStarted` | First message |
| Manager welcome | Message read | HR message read + 2s | 1,000 credit cheque |
| Mission Board license | Message read | Manager welcome read + 20s | Mission Board software |
| Software licenses | Message read + software | Mission Board msg read + Mission Board installed + 5s | VPN, NAR, Scanner, File Manager |
| Tutorial Part 1 | Software installed | Mission Board installed (0s delay) | First mission available |
| Tutorial Part 2 | Mission complete | `tutorial-part-1` complete + 30s | Recovery mission + intro message |
| Procedural missions | Message read | "Better" message read (`msg-manager-better`) | 4-6 basic missions in pool |
| Hardware + tools | Credits + message | Balance >= 1,000 AND `betterMessageRead` + 3s | Network adapters, Log Viewer, Data Recovery Tool in Portal |
| Investigation intro | Software installed | `log-viewer` AND `data-recovery-tool` installed + 5s | Investigation intro message |
| Data Detective | Message read | Investigation intro (`msg-investigative-jobs`) read + 3s | `data-detective` mission |
| Investigation pool | Mission complete | `data-detective` success | Investigation missions in procedural pool |
| Decryption threshold | Message read | "Investigation Missions Unlocked" read | Sets threshold = current balance + 10,000 |
| Decryption tease | Credits | Balance >= threshold + 5s | Decryption Tool in Portal, MetroLink teaser |
| Ransomware Recovery | Message read | Decryption tease (`msg-decryption-work`) read + 3s | `ransomware-recovery` mission |

---

## 5. Economic Arc

Track the player's credit balance through the story:

| Event | Change | Running Total |
|-------|--------|--------------|
| Game start | — | 0 |
| Welcome cheque deposited | +1,000 | ~1,000 |
| Tutorial Part 1 failure penalty | -10,000 | ~-9,000 |
| Tutorial Part 2 success payout | +1,000 | ~-8,000 |
| Grinding (4-6 procedural missions) | +500 to +2,000 each | -8,000 → +1,000 |
| Hardware unlock threshold reached | — | +1,000 (gate) |
| Purchase Log Viewer + Data Recovery Tool | -500 to -1,000 each | varies |
| Data Detective success | +3,500 | varies |
| Decryption threshold set | — | current + 10,000 = threshold |
| Continue grinding to reach threshold | varies | threshold reached |
| Purchase Decryption Tool | -500 | varies |
| Ransomware Recovery success | +6,000 | varies |

**Key financial pressure points:**
- After tutorial failure: -9,000 credits, 5-minute bankruptcy timer threatened
- During grind: every mission matters, player can't afford failures
- Tool purchases: must balance investment (buy tools) against safety (maintain positive balance)
- Decryption threshold: the +10,000 gap ensures the player has significant runway before the capstone mission

---

## 6. Narrative Design Patterns

### The Scripted Failure

Tutorial Part 1 always fails. The player completes every objective correctly, then watches helplessly as the system deletes their work, disconnects them, and charges them 10,000 credits. This teaches through consequence: the game world has dangers you can't control, and financial stakes are real. The failure is not punitive — it's the inciting incident that drives the entire narrative arc.

### The Breadcrumb

The manager casually hints at future content in success messages. After the investigation mission: "I'm looking into getting you access to some advanced decryption tools... once you've earned another 10,000 or so." This serves two purposes: it gives the player a concrete goal to work toward, and it makes the eventual unlock feel like a natural story beat rather than a UI toggle.

### The Extension Trap

Mid-mission, the client sends a message asking for "one more thing" that seems routine. In the ransomware mission, this is a "passenger data" file that turns out to be a planted virus. The pattern works because the player has been trained by earlier missions to expect extensions as normal — procedural missions regularly add objectives mid-mission. The ransomware extension exploits that trust.

### Dual Resolution

The ransomware attack offers two valid paths to success:
- **Path A (intended):** Install the emergency antivirus the manager sends. Straightforward, clearly signposted.
- **Path B (discovery):** Manually enter the decryption key on the lock screen. Requires the player to notice and act on environmental information.

Both paths complete the mission, but the manager's reaction differs — relieved and professional for Path A, surprised and slightly suspicious for Path B. This rewards player agency without punishing the "standard" approach.

### Feature Gates as Narrative Beats

Tool unlocks are never just UI events. Every new capability is delivered through a story message:
- The Mission Board comes as a license attachment from the manager
- Investigation tools are introduced with an explanation of what they do and why you need them
- The Decryption Tool arrives with a specific client already lined up

This means every tool the player acquires has context — they know what it's for and why they're getting it now.

---

## 7. Designing Future Story Missions

### Chaining into Existing Progression

New story missions should connect to the existing progression through one of these mechanisms:

1. **`followUpMissions`** — Direct chaining. When a mission succeeds or fails, its `followUpMissions.onSuccess` or `followUpMissions.onFailure` array lists mission IDs to activate next. Example: `tutorial-part-1` failure triggers `tutorial-part-2`.

2. **Message-read triggers** — Gate on information. A mission's `triggers.start` can use `type: "timeSinceEvent"` with `event: "messageRead"` and a `condition: { messageId: "..." }` to activate when the player reads a specific message. Example: `data-detective` triggers when the player reads the investigation intro message.

3. **Credit thresholds** — Gate on financial progress. GameContext watches `creditsChanged` events and sends messages when thresholds are met. Example: the hardware-unlock and decryption-tease messages.

4. **Software-installed triggers** — Gate on tool acquisition. Story events can require multiple software conditions (AND logic). Example: the investigation intro requires both `log-viewer` AND `data-recovery-tool`.

### Template for a New Story Phase

```
1. TRIGGER: Define what activates this phase
   - Credit threshold? Message read? Mission complete? Software installed?

2. INTRO MESSAGE: Manager (or new character) introduces the phase
   - Explain what's changed and why
   - Hint at the mission that's coming
   - Optionally unlock new tools/features via attachments

3. MISSION: The actual playable content
   - Define networks, file systems, objectives
   - Consider: does this mission have scripted events? Extensions? Traps?
   - Define success/failure consequences and messages

4. CONSEQUENCE: What changes after the mission
   - Credits and reputation adjustments
   - Follow-up messages that acknowledge what happened
   - New gates set (credit thresholds, feature unlocks)

5. NEXT GATE: What does this phase unlock?
   - Does it open a new pool of procedural missions?
   - Does it set a threshold for the next story beat?
   - Does it hint at what's coming next (the breadcrumb)?
```

### Adding Missions to the System

1. Create mission JSON in `src/missions/data/`
2. Register it in `src/missions/missionData.js` (import and add to appropriate array)
3. If it has message templates, add them to `src/missions/messageTemplates.js`
4. If it requires new progression gates (credit thresholds, message-read flags), add state and effects to `GameContext.jsx`
5. Persist any new gate state in both `getSaveData()` and `loadGame()` functions

### Open Narrative Threads

These threads are established in the current story but not yet resolved:

- **The attacker behind MetroLink.** The ransomware logs show `unknown_0x4F2A` from `185.243.115.42`. The planted trap file suggests a sophisticated adversary who anticipated cleanup operations. Who are they? Are they connected to the tutorial sabotage?
- **The tutorial sabotage.** Tutorial Part 1's failure is scripted, but within the fiction, someone (or something) caused those files to be deleted instead of repaired. The manager blames the player, but was it really their fault?
- **SourceNet's larger mission.** HR's welcome mentions "securing the global internet space from dark actors and criminals." The player has only seen small client jobs — what is SourceNet actually doing at scale?
- **The manager's backstory.** The manager is always present but reveals very little about themselves. They have authority to send emergency software licenses, negotiate with clients, and access the player's financial data. What's their role in the larger organisation?
