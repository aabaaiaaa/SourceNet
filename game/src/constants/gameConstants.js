// Game Constants for SourceNet

// Starting date/time
export const GAME_START_DATE = new Date('2020-03-25T09:00:00');

// Time speeds
export const TIME_SPEEDS = {
  NORMAL: 1,
  FAST: 10,
};

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
    { id: 'ram-2gb', name: '2GB RAM', capacity: '2GB', price: 150, power: 3 },
    { id: 'ram-4gb', name: '4GB RAM', capacity: '4GB', price: 300, power: 4 },
    { id: 'ram-8gb', name: '8GB RAM', capacity: '8GB', price: 700, power: 6 },
    { id: 'ram-16gb', name: '16GB RAM', capacity: '16GB', price: 1400, power: 8 },
    { id: 'ram-32gb', name: '32GB RAM', capacity: '32GB', price: 3000, power: 12 },
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
  portal: { width: 700, height: 600 },
  missionBoard: { width: 700, height: 500 },
  vpnClient: { width: 600, height: 450 },
  networkScanner: { width: 650, height: 500 },
  networkAddressRegister: { width: 600, height: 450 },
  fileManager: { width: 700, height: 550 },
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
