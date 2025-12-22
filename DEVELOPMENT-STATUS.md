# SourceNet Phase 1 - Development Status

## Current Status: Core Infrastructure Complete ✓

The foundational game systems have been implemented. The React/Vite project is set up with comprehensive state management, game mechanics, and core utilities.

---

## ✓ Completed Components

### 1. Project Setup
- ✓ React + Vite project initialized
- ✓ Folder structure created
- ✓ Package dependencies installed

### 2. Core Systems (game/src/constants/gameConstants.js)
- ✓ Starting hardware configuration (CPU, RAM, SSD, motherboard, PSU, network)
- ✓ Complete hardware catalog (processors, memory, storage, motherboards, power supplies, network adapters)
- ✓ Software catalog (OSNet, Portal, Mail, Banking, VPN Client)
- ✓ Initial messages (HR welcome, manager welcome with cheque)
- ✓ Window sizes and boot timing constants
- ✓ Message timing configuration

### 3. Utility Functions (game/src/utils/helpers.js)
- ✓ Generate random Mail IDs (SNET-XXX-XXX-XXX format)
- ✓ Generate random usernames (agent_XXXX format)
- ✓ Format date/time (dd/mm/yyyy hh:mm:ss)
- ✓ Calculate power consumption
- ✓ Check if hardware is installed
- ✓ Calculate cascade window positions
- ✓ Save/load game state to/from localStorage
- ✓ Get all saves, delete saves, check if saves exist

### 4. Game Context (game/src/contexts/GameContext.jsx)
Complete React Context with state management for:

**State:**
- ✓ Game phase tracking (boot/login/username/desktop)
- ✓ Username and player Mail ID
- ✓ Current time with 1x/10x speed toggle
- ✓ Pause functionality
- ✓ Hardware and software configuration
- ✓ Bank accounts with balance tracking
- ✓ Messages (read/unread/archived status, attachments)
- ✓ Window management (position, z-index, minimized state)
- ✓ Manager name generation

**Actions:**
- ✓ Initialize player (username, Mail ID)
- ✓ Add message with notification
- ✓ Mark message as read
- ✓ Archive message
- ✓ Deposit cheque (one-time use, updates balance)
- ✓ Window operations (open/close/minimize/restore/bring to front/move)
- ✓ Toggle time speed
- ✓ Calculate total credits across accounts
- ✓ Save/load game
- ✓ Time management (interval updates based on speed)

### 5. Styling (game/src/styles/main.css)
- ✓ Base CSS reset and layout
- ✓ OSNet theme variables (light corporate greys)
- ✓ Retro-hacker theme (login screen - mustard/green on dark)
- ✓ Window styles (header, content, controls)
- ✓ Minimized window bar styles
- ✓ Top bar styles
- ✓ Boot sequence styles

---

## 🚧 Remaining Work

### High Priority - UI Components

#### 1. Desktop Component (game/src/components/ui/Desktop.jsx)
**Status:** Not started
**Requirements:**
- Display OSNet logo watermark
- Render all open windows
- Render MinimizedWindowBar at bottom
- Handle click events to bring windows to front

#### 2. TopBar Component (game/src/components/ui/TopBar.jsx)
**Status:** Not started
**Requirements:**
- Power button (left) with menu (Pause, Save, Load, Reboot, Sleep)
- Date/Time display (left-center) - updates every second
- Time speed toggle (1x ↔ 10x) - to right of date/time
- Notification icons (Mail, Bank) with hover preview and click to open
- Credits display (clickable, opens Banking App)
- App launcher button (right) with hover menu

#### 3. Window Component (game/src/components/ui/Window.jsx)
**Status:** Not started
**Requirements:**
- Draggable by header
- Fixed size per app type
- Header with title, minimize (_), close (X) buttons
- Content area renders app component
- Click anywhere brings to front
- Position and z-index from GameContext

#### 4. MinimizedWindowBar Component (game/src/components/ui/MinimizedWindowBar.jsx)
**Status:** Not started
**Requirements:**
- Fixed at bottom of screen
- Shows minimized windows as headers (title + restore icon)
- Side-by-side stacking (first minimized = leftmost)
- Width shows most of app title
- Click to restore window

### High Priority - Applications

#### 5. SNet Mail App (game/src/components/apps/SNetMail.jsx)
**Status:** Not started
**Requirements:**
- Player's Mail ID displayed at top
- Two tabs: Inbox, Archive
- Message list: Sender (Mail ID), Subject, Date/Time
- Click message to open and mark as read
- Archive button moves message to Archive tab
- Cheque attachment: clickable, shows "Deposited" status after use
- Cannot delete messages in Phase 1

#### 6. Banking App (game/src/components/apps/BankingApp.jsx)
**Status:** Not started
**Requirements:**
- List all linked accounts
- Show bank name and balance per account
- Cheque deposit prompt when opened via cheque click
- Account selection list
- Update balance after deposit
- Starting account: First Bank Ltd with 0 credits

#### 7. Portal App (game/src/components/apps/Portal.jsx)
**Status:** Not started
**Requirements:**
- Two main categories: Hardware, Software
- Hardware subdivisions: Processors, Memory, Storage, Motherboards, Power Supplies, Network
- Display name, specs, price for all items
- Show "Installed" badge for owned items
- Software section: Show VPN Client as unavailable
- Browse only (no purchasing in Phase 1)

### Medium Priority - Boot & Login

#### 8. Boot Sequence (game/src/components/boot/BootSequence.jsx)
**Status:** Not started
**Requirements:**
- BIOS screen with OSNet ASCII art
- Hardware detection (show all components)
- Empty slots shown based on motherboard spec
- Checksums for each component
- Power rating check
- Network adapter connection + speed test
- OS detection (none found on first boot)
- OS installation screen with OSNet ASCII art (books on shelf)
- Installation progress bar (varying speeds)
- First boot: ~15 seconds
- Subsequent boots: ~4 seconds (skip installation)

#### 9. Username Selection (game/src/components/boot/UsernameSelection.jsx)
**Status:** Not started
**Requirements:**
- Appears after first boot
- Show suggested username (agent_XXXX format)
- Allow editing (max 15 characters)
- Submit button to continue to desktop

#### 10. Game Login Screen (game/src/components/GameLoginScreen.jsx)
**Status:** Not started
**Requirements:**
- Retro-hacker theme (dark bg, mustard/green font, monospace)
- List all saved game usernames
- Click username to load latest save
- Delete button per save
- "New Game" button at bottom
- Only shown when multiple saves exist

### Medium Priority - Game Root

#### 11. GameRoot Component (game/src/components/GameRoot.jsx)
**Status:** Not started
**Requirements:**
- Route based on gamePhase:
  - 'boot' → BootSequence
  - 'login' → GameLoginScreen
  - 'username' → UsernameSelection
  - 'desktop' → Desktop with TopBar
- Handle initial game state (check for saves)

### Low Priority - Polish

#### 12. Notification System
**Status:** Partial (logic exists in GameContext)
**Remaining:**
- Create audio file for OSNet notification chime
- Implement playNotificationChime() function
- Add audio element to project

#### 13. ASCII Art Assets
**Status:** Not started
**Requirements:**
- OSNet BIOS logo
- SourceNet OSNet OS logo (books on shelf)
- OSNet desktop watermark

### Low Priority - Testing

#### 14. Testing Infrastructure
**Status:** Not started
**Tools needed:**
- Jest (included with Vite)
- @testing-library/react
- @testing-library/user-event
- @testing-library/jest-dom
- @playwright/test

#### 15. Unit Tests
**Status:** Not started
**Files to test:**
- utils/helpers.js (all utility functions)
- Time system logic
- Save/load system
- Credit calculations

#### 16. Component Tests
**Status:** Not started
**Components to test:**
- All UI components
- All applications
- Window management
- Notification system

#### 17. E2E Tests
**Status:** Not started
**Scenarios from spec:**
- First boot sequence (39 steps)
- Game login screen (14 steps)
- Save/load cycle (17 steps)
- Window management flow (15 steps)
- App interactions (21 steps)
- Time system (21 steps)

---

## Running the Game

### Start Development Server
```bash
cd game
npm run dev
```

The app will run at `http://localhost:5173` (or next available port)

### Current View
Right now you'll see a placeholder screen listing the implemented core systems.

---

## Development Workflow

### 1. Start with High Priority UI Components
Begin with the foundational UI:
1. Create `GameRoot.jsx` to handle routing
2. Create `Desktop.jsx` for the main game area
3. Create `TopBar.jsx` for the top control bar
4. Create `Window.jsx` for draggable windows
5. Create `MinimizedWindowBar.jsx` for the bottom bar

### 2. Build Applications
Once windows work, create the apps:
1. `SNetMail.jsx` - Message viewing and management
2. `BankingApp.jsx` - Account and cheque management
3. `Portal.jsx` - Hardware/software browsing

### 3. Add Boot Sequence
Make the game bootable:
1. `BootSequence.jsx` - Hardware detection and OS installation
2. `UsernameSelection.jsx` - Player name input
3. `GameLoginScreen.jsx` - Save game selection

### 4. Polish & Test
Final touches:
1. Add notification audio
2. Add ASCII art assets
3. Set up testing infrastructure
4. Write comprehensive tests

---

## File Organization

```
game/src/
├── components/
│   ├── ui/                    # UI Components (Desktop, TopBar, Window, etc.)
│   ├── apps/                  # Game Applications (Mail, Banking, Portal)
│   ├── boot/                  # Boot Sequence Components
│   └── GameRoot.jsx           # Main routing component
├── contexts/
│   └── GameContext.jsx        # ✓ Complete game state management
├── hooks/                     # Custom React hooks (future)
├── utils/
│   └── helpers.js             # ✓ Utility functions
├── constants/
│   └── gameConstants.js       # ✓ Game constants
├── styles/
│   └── main.css               # ✓ Base styles
├── assets/
│   ├── images/                # ASCII art, logos, etc.
│   └── sounds/                # Notification chimes
├── App.jsx                    # ✓ Main app component
└── main.jsx                   # Entry point
```

---

## Key Design Patterns

### State Management
- **GameContext** is the single source of truth for all game state
- Use `useGame()` hook in components to access state and actions
- All state mutations go through GameContext actions

### Window Management
- Each window has: `appId`, `zIndex`, `minimized`, `position`
- Z-index increases sequentially for stacking order
- Cascade position calculated based on existing open windows
- Minimized windows stored in order of minimization

### Time System
- Time advances via setInterval in GameContext
- Speed multiplier (1x or 10x) applied to interval updates
- Time pauses when isPaused=true or gamePhase≠'desktop'
- Always resets to 1x on load

### Message Delivery
- Messages added with timestamp
- Notification chime plays when message arrives
- Second message scheduled when first message marked as read
- Cheque attachment tracked separately with deposited flag

---

## Testing Strategy

### Unit Tests
Focus on pure functions and game logic:
- Utility functions (ID generation, formatting, calculations)
- Save/load system
- Power consumption calculations
- Cascade position calculations

### Component Tests
Test UI behavior and user interactions:
- Window dragging and minimizing
- TopBar controls (time toggle, app launcher)
- Message reading and archiving
- Cheque deposit flow

### Integration Tests
Test complex multi-component interactions:
- Window management (open → minimize → restore)
- Message system (arrive → read → archive)
- Cheque deposit (click → select account → balance update)

### E2E Tests
Test complete user flows from spec:
- Full boot sequence
- Save/load cycle
- Complete gameplay session

---

## Next Steps

1. **Create GameRoot** - Start with routing logic
2. **Build Desktop** - Main game container
3. **Build Window** - Core window component
4. **Build TopBar** - Control interface
5. **Test window management** - Ensure windows work properly
6. **Build SNet Mail** - First application
7. **Build Banking App** - With cheque deposit
8. **Build Portal** - Hardware/software browser
9. **Build Boot Sequence** - Make game bootable
10. **Polish** - Audio, ASCII art, final touches
11. **Test** - Comprehensive test suite

---

## Important Notes

- **All core game mechanics are complete** - No logic changes needed
- **GameContext is production-ready** - Fully implements Phase 1 spec
- **Remaining work is primarily UI** - Components that use GameContext
- **No complex algorithms left** - State management handles all complexity
- **Test early and often** - Catch issues as you build each component

---

## Estimated Effort

- **High Priority UI & Apps:** ~8-12 hours
- **Boot & Login:** ~4-6 hours
- **Polish:** ~2-4 hours
- **Testing:** ~6-8 hours

**Total:** ~20-30 hours of focused development

---

## Questions?

Refer to `phase-1-design-spec.md` for complete requirements and specifications.

All game constants and configurations are in `src/constants/gameConstants.js`.

All utility functions are documented in `src/utils/helpers.js`.

GameContext API is fully documented inline in `src/contexts/GameContext.jsx`.
