/**
 * NetworkDeviceGenerator - Generates network devices for scanning
 * 
 * Creates deterministic device lists based on network properties
 * and mission requirements. Uses network ID as seed for consistency.
 */

/**
 * Simple seeded random number generator
 * @param {string} seed - Seed string (network ID)
 * @returns {function} Random number generator function
 */
function createSeededRandom(seed) {
    let hash = 0;
    for (let i = 0; i < seed.length; i++) {
        hash = ((hash << 5) - hash) + seed.charCodeAt(i);
        hash = hash & hash; // Convert to 32-bit integer
    }

    return function () {
        hash = (hash * 9301 + 49297) % 233280;
        return hash / 233280;
    };
}

/**
 * Generate IP address within network range
 * @param {string} networkAddress - Network CIDR (e.g., "192.168.50.0/24")
 * @param {number} hostNumber - Host number (1-254)
 * @returns {string} IP address
 */
function generateIPInRange(networkAddress, hostNumber) {
    const [baseIP] = networkAddress.split('/');
    const octets = baseIP.split('.');
    // Use the host number for the last octet
    octets[3] = String(Math.max(1, Math.min(254, hostNumber)));
    return octets.join('.');
}

/**
 * Generate hostname based on device type and index
 * @param {string} type - Device type
 * @param {number} index - Device index
 * @param {function} random - Random function
 * @returns {string} Hostname
 */
function generateHostname(type, index, random) {
    const patterns = {
        fileserver: () => `fileserver-${String(index).padStart(2, '0')}`,
        database: () => `db-${['primary', 'backup', 'analytics', 'staging'][Math.floor(random() * 4)]}-${String(index).padStart(2, '0')}`,
        workstation: () => `ws-${String(Math.floor(random() * 900) + 100)}`,
        printer: () => `printer-floor${Math.floor(random() * 5) + 1}`,
        iot: () => {
            const devices = ['camera', 'thermostat', 'badge-reader', 'door-lock', 'sensor'];
            return `${devices[Math.floor(random() * devices.length)]}-${String(index).padStart(2, '0')}`;
        },
    };

    return patterns[type] ? patterns[type]() : `device-${index}`;
}

/**
 * Get required devices from narEntry file systems
 * @param {Object} narEntry - NAR entry with fileSystems
 * @returns {Array} Array of required device objects
 */
export function getRequiredDevices(narEntry) {
    if (!narEntry || !narEntry.fileSystems || narEntry.fileSystems.length === 0) {
        return [];
    }

    return narEntry.fileSystems.map(fs => ({
        ip: fs.ip,
        hostname: fs.name,
        id: fs.id,
        type: determineDeviceType(fs.name),
        fileSystems: fs.files ? [`/${fs.name}/`] : [],
        required: true, // Mark as mission-critical
    }));
}

/**
 * Determine device type from hostname
 * @param {string} hostname - Device hostname
 * @returns {string} Device type
 */
function determineDeviceType(hostname) {
    const lower = hostname.toLowerCase();
    if (lower.includes('fileserver') || lower.includes('file-server')) return 'fileserver';
    if (lower.includes('database') || lower.includes('db')) return 'database';
    if (lower.includes('backup')) return 'fileserver';
    if (lower.includes('ws-') || lower.includes('workstation')) return 'workstation';
    if (lower.includes('printer')) return 'printer';
    if (lower.includes('camera') || lower.includes('iot') || lower.includes('sensor')) return 'iot';
    return 'fileserver'; // Default for unknown types
}

/**
 * Generate random background devices
 * @param {Object} network - Network object with address
 * @param {number} count - Number of devices to generate
 * @param {Array} types - Device types to include
 * @param {function} random - Seeded random function
 * @param {number} startIP - Starting IP host number
 * @returns {Array} Array of device objects
 */
export function generateRandomDevices(network, count, types, random, startIP = 30) {
    const devices = [];
    const usedIPs = new Set();

    for (let i = 0; i < count; i++) {
        const type = types[Math.floor(random() * types.length)];

        // Generate unique IP
        let hostNumber;
        do {
            hostNumber = startIP + Math.floor(random() * 200);
        } while (usedIPs.has(hostNumber));
        usedIPs.add(hostNumber);

        const ip = generateIPInRange(network.address, hostNumber);
        const hostname = generateHostname(type, i + 1, random);

        devices.push({
            ip,
            hostname,
            id: `${type}-${i + 1}`,
            type,
            fileSystems: type === 'fileserver' || type === 'database' ? [`/${hostname}/`] : [],
            required: false,
        });
    }

    return devices;
}

/**
 * Generate devices for a network based on narEntry and scan type
 * @param {Object} narEntry - NAR entry with network info and fileSystems
 * @param {string} scanType - 'quick' or 'deep'
 * @returns {Array} Array of device objects
 */
export function generateDevicesForNetwork(narEntry, scanType = 'deep') {
    if (!narEntry) {
        return [];
    }

    // Get required devices from narEntry fileSystems
    const requiredDevices = getRequiredDevices(narEntry);

    // Quick scan only returns critical devices (fileserver, database)
    if (scanType === 'quick') {
        return requiredDevices.filter(d =>
            d.type === 'fileserver' || d.type === 'database'
        );
    }

    // Deep scan includes required devices + random background devices
    const random = createSeededRandom(narEntry.networkId);

    // Determine how many random devices to add (2-5 based on network)
    const randomCount = Math.floor(random() * 4) + 2;

    // Background device types for deep scans
    const backgroundTypes = ['workstation', 'printer', 'iot'];

    // Find the highest IP used by required devices to avoid collisions
    const maxUsedIP = requiredDevices.reduce((max, device) => {
        const lastOctet = parseInt(device.ip.split('.')[3], 10);
        return Math.max(max, lastOctet);
    }, 10);

    const randomDevices = generateRandomDevices(
        narEntry,
        randomCount,
        backgroundTypes,
        random,
        maxUsedIP + 1
    );

    // Combine and return all devices
    return [...requiredDevices, ...randomDevices];
}

/**
 * Map devices to include fileSystems from narEntry
 * @param {Array} devices - Generated devices
 * @param {Object} narEntry - NAR entry with fileSystems
 * @returns {Array} Devices with fileSystems populated
 */
export function mapDevicesToFileSystems(devices, narEntry) {
    if (!narEntry || !narEntry.fileSystems) {
        return devices;
    }

    return devices.map(device => {
        // Find matching file system by IP
        const matchingFS = narEntry.fileSystems.find(fs => fs.ip === device.ip);

        if (matchingFS) {
            return {
                ...device,
                fileSystems: matchingFS.files ? [`/${matchingFS.name}/`] : device.fileSystems,
            };
        }

        return device;
    });
}
