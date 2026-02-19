// Game Constants for SourceNet

// Version
export const APP_VERSION = '0.1.0-alpha';

// Starting date/time
export const GAME_START_DATE = new Date('2020-03-25T09:00:00');

// Local SSD constants
export const LOCAL_SSD_NETWORK_ID = 'local';
export const LOCAL_SSD_BANDWIDTH = 4000; // ~500 MB/s SSD speed in Mbps
export const LOCAL_SSD_CAPACITY_GB = 90;

// Time speeds
export const TIME_SPEEDS = {
  NORMAL: 1,
  FAST: 10,
  TEST: 100, // For automated testing only
};

// Apps that allow multiple instances to be opened
export const MULTI_INSTANCE_APPS = ['fileManager'];

// Starting hardware configuration
export const STARTING_HARDWARE = {
  cpu: {
    id: 'cpu-1ghz-single',
    name: '1GHz Single Core',
    specs: '1GHz, 1 core',
    price: 200,
    power: 65,
  },
  memory: [
    {
      id: 'ram-2gb',
      name: '2GB RAM',
      capacity: '2GB',
      capacityMB: 2048,
      price: 150,
      power: 3,
    },
  ],
  storage: [
    {
      id: 'ssd-90gb',
      name: '90GB SSD',
      capacity: '90GB',
      price: 100,
      power: 2,
    },
  ],
  motherboard: {
    id: 'board-basic',
    name: 'Basic Board',
    cpuSlots: 1,
    memorySlots: 2,
    storageSlots: 2,
    networkSlots: 1,
    price: 150,
    power: 5,
  },
  powerSupply: {
    id: 'psu-300w',
    name: '300W PSU',
    wattage: 300,
    price: 80,
  },
  network: {
    id: 'net-250mb',
    name: '250Mb Network Card',
    speed: 250,
    price: 100,
    power: 5,
  },
};

// Starting software
export const STARTING_SOFTWARE = [
  {
    id: 'osnet',
    name: 'OSNet',
    type: 'os',
    canRemove: false,
  },
  {
    id: 'portal',
    name: 'OSNet Software/Hardware Portal',
    type: 'system',
    canRemove: false,
  },
  {
    id: 'mail',
    name: 'SNet Mail',
    type: 'system',
    canRemove: false,
  },
  {
    id: 'banking',
    name: 'SNet Banking App',
    type: 'system',
    canRemove: false,
  },
];

// RAM costs per app (in MB) - used for resource management
export const APP_RAM_COSTS = {
  mail: 64,
  banking: 64,
  portal: 128,
  missionBoard: 96,
  vpnClient: 128,
  networkScanner: 128,
  networkAddressRegister: 64,
  fileManager: 192,
  logViewer: 128,
  dataRecoveryTool: 256,
  decryptionTool: 384,
  passwordCracker: 512,
  networkSniffer: 384,
  // Passive apps (consume RAM while running)
  'advanced-firewall-av': 256,
  'trace-monitor': 192,
};

// Password hash types and their properties
export const PASSWORD_HASH_TYPES = {
  md5: { name: 'MD5', difficulty: 1, baseTimeMs: 5000, dictionaryEffective: true },
  sha1: { name: 'SHA-1', difficulty: 2, baseTimeMs: 15000, dictionaryEffective: false },
  sha256: { name: 'SHA-256', difficulty: 3, baseTimeMs: 45000, dictionaryEffective: false },
  bcrypt: { name: 'bcrypt', difficulty: 4, baseTimeMs: 120000, dictionaryEffective: false, bruteForceOnly: true },
};

// CPU speed multipliers for cracking (base is 1GHz single core = 1x)
export const CPU_CRACK_MULTIPLIERS = {
  'cpu-1ghz-single': 1,
  'cpu-2ghz-dual': 3,
  'cpu-3ghz-dual': 5,
  'cpu-4ghz-quad': 12,
  'cpu-6ghz-octa': 30,
};

// Relay node defaults
export const RELAY_DEFAULTS = {
  initialNodeCount: 6,
  maxSuspicion: 100,
  suspicionPerUse: 15,
  frontNodeSuspicionMultiplier: 2.5,
  baseETTMs: 120000, // 2 minutes base ETT per relay
  replacementCost: 2000,
};

// Trace consequence thresholds
export const TRACE_CONSEQUENCES = {
  maxRebuilds: 2,
  darkWebTargetChance: 0.3,
  rebuildBaseCost: 5000,
};

// Hardware catalog
export const HARDWARE_CATALOG = {
  processors: [
    { id: 'cpu-1ghz-single', name: '1GHz Single Core', specs: '1GHz, 1 core', price: 200, power: 65 },
    { id: 'cpu-2ghz-dual', name: '2GHz Dual Core', specs: '2GHz, 2 cores', price: 800, power: 95 },
    { id: 'cpu-3ghz-dual', name: '3GHz Dual Core', specs: '3GHz, 2 cores', price: 1500, power: 125 },
    { id: 'cpu-4ghz-quad', name: '4GHz Quad Core', specs: '4GHz, 4 cores', price: 3000, power: 150 },
    { id: 'cpu-6ghz-octa', name: '6GHz Octa Core', specs: '6GHz, 8 cores', price: 6000, power: 180 },
  ],
  memory: [
    { id: 'ram-2gb', name: '2GB RAM', capacity: '2GB', capacityMB: 2048, price: 150, power: 3 },
    { id: 'ram-4gb', name: '4GB RAM', capacity: '4GB', capacityMB: 4096, price: 300, power: 4 },
    { id: 'ram-8gb', name: '8GB RAM', capacity: '8GB', capacityMB: 8192, price: 700, power: 6 },
    { id: 'ram-16gb', name: '16GB RAM', capacity: '16GB', capacityMB: 16384, price: 1400, power: 8 },
    { id: 'ram-32gb', name: '32GB RAM', capacity: '32GB', capacityMB: 32768, price: 3000, power: 12 },
  ],
  storage: [
    { id: 'ssd-90gb', name: '90GB SSD', capacity: '90GB', price: 100, power: 2 },
    { id: 'ssd-250gb', name: '250GB SSD', capacity: '250GB', price: 200, power: 2 },
    { id: 'ssd-500gb', name: '500GB SSD', capacity: '500GB', price: 400, power: 3 },
    { id: 'ssd-1tb', name: '1TB SSD', capacity: '1TB', price: 900, power: 4 },
    { id: 'ssd-2tb', name: '2TB SSD', capacity: '2TB', price: 2000, power: 5 },
  ],
  motherboards: [
    {
      id: 'board-basic',
      name: 'Basic Board',
      cpuSlots: 1,
      memorySlots: 2,
      storageSlots: 2,
      networkSlots: 1,
      price: 150,
      power: 5,
    },
    {
      id: 'board-standard',
      name: 'Standard Board',
      cpuSlots: 1,
      memorySlots: 4,
      storageSlots: 3,
      networkSlots: 1,
      price: 500,
      power: 8,
    },
  ],
  powerSupplies: [
    { id: 'psu-300w', name: '300W PSU', wattage: 300, price: 80 },
    { id: 'psu-500w', name: '500W PSU', wattage: 500, price: 150 },
    { id: 'psu-750w', name: '750W PSU', wattage: 750, price: 300 },
    { id: 'psu-1000w', name: '1000W PSU', wattage: 1000, price: 500 },
    { id: 'psu-1500w', name: '1500W PSU', wattage: 1500, price: 800 },
  ],
  network: [
    { id: 'net-250mb', name: '250Mb Network Card', speed: 250, price: 100, power: 5 },
    { id: 'net-500mb', name: '500Mb Network Card', speed: 500, price: 200, power: 6 },
    { id: 'net-1gb', name: '1Gb Network Card', speed: 1000, price: 500, power: 8 },
    { id: 'net-5gb', name: '5Gb Network Card', speed: 5000, price: 1200, power: 10 },
    { id: 'net-10gb', name: '10Gb Network Card', speed: 10000, price: 2500, power: 15 },
  ],
};

// Software catalog
export const SOFTWARE_CATALOG = [
  {
    id: 'mission-board',
    name: 'SourceNet Mission Board',
    description: 'View and accept SourceNet contracts',
    price: 250,
    sizeInMB: 25, // ~4 seconds at 50 Mbps
    available: true,
  },
  {
    id: 'vpn-client',
    name: 'SourceNet VPN Client',
    description: 'Secure connection to private networks',
    price: 500,
    sizeInMB: 45, // ~7 seconds at 50 Mbps
    available: true,
  },
  {
    id: 'network-scanner',
    name: 'Network Scanner',
    description: 'Scan networks for machines and file systems',
    price: 300,
    sizeInMB: 30, // ~5 seconds at 50 Mbps
    available: true,
  },
  {
    id: 'network-address-register',
    name: 'Network Address Register',
    description: 'Manage network connections and credentials',
    price: 200,
    sizeInMB: 15, // ~2.5 seconds at 50 Mbps
    available: true,
  },
  {
    id: 'file-manager',
    name: 'File Manager',
    description: 'Access and manipulate files on remote systems',
    price: 350,
    sizeInMB: 35, // ~5.5 seconds at 50 Mbps
    available: true,
  },
  {
    id: 'log-viewer',
    name: 'Log Viewer',
    description: 'View network connection and device operation logs',
    price: 350,
    sizeInMB: 25, // ~4 seconds at 50 Mbps
    available: true,
    requiresUnlock: 'investigation-tooling',
  },
  {
    id: 'data-recovery-tool',
    name: 'Data Recovery Tool',
    description: 'Scan for deleted files, restore them, or securely delete data',
    price: 400,
    sizeInMB: 30, // ~5 seconds at 50 Mbps
    available: true,
    requiresUnlock: 'investigation-tooling',
  },
  {
    id: 'decryption-tool',
    name: 'Decryption Tool',
    description: 'Decrypt encrypted files using cryptographic algorithms. Includes AES-128 and AES-256 decryption modules. Additional algorithm packs available separately.',
    price: 8000,
    sizeInMB: 350,
    available: true,
    requiresUnlock: 'decryption-tooling',
  },
  {
    id: 'advanced-firewall-av',
    name: 'Advanced Firewall & Antivirus',
    description: 'Real-time threat protection and malware removal',
    price: 2000,
    sizeInMB: 50,
    available: true,
    requiresUnlock: 'security-tooling',
    passive: true,
  },
  {
    id: 'algorithm-pack-blowfish',
    name: 'Blowfish Decryption Module',
    description: 'Advanced symmetric cipher module for Decryption Tool. Enables decryption of Blowfish-encrypted files commonly found in financial and corporate systems.',
    price: 15000,
    sizeInMB: 1800,
    available: true,
    requiresUnlock: 'decryption-algorithms',
  },
  {
    id: 'algorithm-pack-rsa',
    name: 'RSA-2048 Decryption Module',
    description: 'Asymmetric encryption module for Decryption Tool. Enables decryption of RSA-2048 encrypted files used in government and military-grade security systems.',
    price: 35000,
    sizeInMB: 3200,
    available: true,
    requiresUnlock: 'decryption-algorithms',
  },
  {
    id: 'password-cracker',
    name: 'Password Cracker',
    description: 'Crack password-protected files using dictionary attacks, brute force, or rainbow tables. Supports MD5, SHA-1, SHA-256, and bcrypt hashes. Very RAM-intensive.',
    price: 10000,
    sizeInMB: 500,
    available: true,
    requiresUnlock: 'cracking-tooling',
  },
  {
    id: 'dictionary-pack-common',
    name: 'Dictionary Pack - Common',
    description: 'Common password dictionary for Password Cracker. Contains 10 million frequently used passwords. Effective against weak MD5 and SHA-1 hashes.',
    price: 12000,
    sizeInMB: 800,
    available: true,
    requiresUnlock: 'cracking-tooling',
  },
  {
    id: 'dictionary-pack-extended',
    name: 'Dictionary Pack - Extended',
    description: 'Extended password dictionary for Password Cracker. Contains 100 million passwords including variations, leaked databases, and common patterns.',
    price: 18000,
    sizeInMB: 2500,
    available: true,
    requiresUnlock: 'cracking-tooling',
  },
  {
    id: 'rainbow-table-md5',
    name: 'Rainbow Table - MD5',
    description: 'Pre-computed MD5 hash lookup table. Enables near-instant cracking of MD5-hashed passwords. Very large storage requirement.',
    price: 15000,
    sizeInMB: 5000,
    available: true,
    requiresUnlock: 'cracking-tooling',
  },
  {
    id: 'rainbow-table-sha256',
    name: 'Rainbow Table - SHA-256',
    description: 'Pre-computed SHA-256 hash lookup table. Enables fast cracking of SHA-256 hashed passwords. Extremely large storage requirement.',
    price: 25000,
    sizeInMB: 12000,
    available: true,
    requiresUnlock: 'cracking-tooling',
  },
  {
    id: 'vpn-relay-upgrade',
    name: 'VPN Relay Module',
    description: 'Upgrade for VPN Client. Enables connection routing through relay nodes to avoid detection by threat actors. Requires active relay service subscription.',
    price: 3000,
    sizeInMB: 150,
    available: true,
    requiresUnlock: 'relay-service',
  },
  {
    id: 'trace-monitor',
    name: 'Trace Monitor',
    description: 'Passive monitoring tool that detects active network tracing. Provides audio and visual warnings when threat actors are tracing your connection. Consumes CPU, RAM, and bandwidth.',
    price: 2500,
    sizeInMB: 100,
    available: true,
    requiresUnlock: 'relay-service',
    passive: true,
  },
  {
    id: 'network-sniffer',
    name: 'Network Sniffer',
    description: 'Monitor network traffic to extract credentials and investigate suspicious activity. Capture packets, reconstruct hashes, and analyze traffic patterns.',
    price: 50000,
    sizeInMB: 400,
    available: true,
    requiresUnlock: 'sniffer-tooling',
  },
];

// Services catalog (purchased from Portal Services tab)
export const SERVICES_CATALOG = [
  {
    id: 'relay-service-standard',
    name: 'Standard Relay Service',
    description: 'Provides a set of 6 relay nodes for anonymous network routing. Relay nodes appear in VPN Client when the Relay Module is installed. Required for relay-based connections.',
    price: 30000,
    oneTimePurchase: true,
    requiresUnlock: 'relay-service',
  },
  {
    id: 'relay-node-replacement',
    name: 'Replacement Relay Node',
    description: 'Purchase a new relay node to replace a burned one. Each purchase adds one new relay node to your available pool.',
    price: 2000,
    oneTimePurchase: false,
    requiresUnlock: 'relay-service',
    requiresService: 'relay-service-standard',
  },
];

// Initial messages
export const INITIAL_MESSAGES = [
  {
    id: 'msg-welcome-hr',
    from: 'SourceNet Human Resources',
    fromId: 'SNET-HQ0-000-001',
    subject: 'Welcome to SourceNet!',
    body: `Welcome to SourceNet!

We are dedicated to securing the global internet space from dark actors and criminals, making it a safe place for all users. You are now part of this important mission.

Your assigned manager will be contacting you shortly with further instructions.

You have been provided with basic software to get started. To view available software and hardware upgrades, access the OSNet Software/Hardware Portal from your app launcher.

Welcome to the family.

- SourceNet Human Resources`,
    timestamp: null, // Will be set to game time + 2 seconds
    read: false,
    archived: false,
  },
];

// Manager first names for random selection
export const MANAGER_NAMES = [
  'Alex',
  'Jordan',
  'Morgan',
  'Sam',
  'Casey',
  'Taylor',
  'Riley',
  'Avery',
  'Quinn',
  'Reese',
];

// Bank configuration
export const STARTING_BANK_ACCOUNT = {
  id: 'account-first-bank',
  bankName: 'First Bank Ltd',
  balance: 0,
};

// Window sizes (fixed per app)
export const WINDOW_SIZES = {
  mail: { width: 600, height: 600 },
  banking: { width: 500, height: 500 },
  portal: { width: 700, height: 750 },
  missionBoard: { width: 700, height: 500 },
  vpnClient: { width: 650, height: 650 },
  networkScanner: { width: 650, height: 500 },
  networkAddressRegister: { width: 600, height: 450 },
  fileManager: { width: 700, height: 550 },
  logViewer: { width: 650, height: 500 },
  dataRecoveryTool: { width: 700, height: 550 },
  decryptionTool: { width: 750, height: 600 },
  passwordCracker: { width: 750, height: 650 },
  networkSniffer: { width: 800, height: 650 },
};

// Boot sequence timing
export const BOOT_TIMING = {
  FIRST_BOOT: 15000, // 15 seconds
  SUBSEQUENT_BOOT: 4000, // 4 seconds
};

// Message timing
export const MESSAGE_TIMING = {
  FIRST_MESSAGE_DELAY: 2000, // 2 seconds after desktop loads
  SECOND_MESSAGE_DELAY: 2000, // 2 seconds after first message is read
};

// Mission verification delay (in game-time milliseconds)
export const VERIFICATION_DELAY_MS = 3000;
