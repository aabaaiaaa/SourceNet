/**
 * Device Templates - Industry-specific device definitions for procedural network generation
 *
 * Used by MissionGenerator to create narrative-relevant devices that fit the client's industry.
 * These make networks feel more realistic and immersive than generic "fileserver-01" names.
 */

/**
 * Device templates organized by industry
 * Each industry has categories: servers, workstations, infrastructure
 */
export const deviceTemplatesByIndustry = {
    banking: {
        servers: [
            'atm-controller', 'transaction-server', 'ledger-db', 'audit-server',
            'core-banking-srv', 'payment-gateway', 'fraud-detection', 'loan-processing',
            'compliance-db', 'clearing-house', 'wire-transfer-srv', 'forex-server'
        ],
        workstations: [
            'teller-terminal', 'branch-manager-ws', 'loan-officer-ws', 'customer-service-ws',
            'risk-analyst-ws', 'trader-ws', 'compliance-ws', 'back-office-ws'
        ],
        infrastructure: [
            'vault-monitor', 'security-gateway', 'backup-nas', 'branch-router',
            'atm-network-hub', 'card-reader-hub', 'biometric-controller', 'cctv-recorder'
        ]
    },
    healthcare: {
        servers: [
            'ehr-server', 'imaging-server', 'pharmacy-db', 'lab-system',
            'pacs-archive', 'radiology-srv', 'billing-server', 'patient-portal',
            'clinical-db', 'scheduling-srv', 'hl7-interface', 'dicom-gateway'
        ],
        workstations: [
            'nurse-station', 'doctor-terminal', 'registration-ws', 'pharmacy-ws',
            'radiology-ws', 'lab-technician-ws', 'admin-reception', 'billing-ws'
        ],
        infrastructure: [
            'patient-monitor', 'medical-gateway', 'archive-nas', 'backup-server',
            'nurse-call-hub', 'vitals-aggregator', 'infusion-controller', 'bed-tracker'
        ]
    },
    government: {
        servers: [
            'citizen-records-db', 'permit-server', 'case-management', 'tax-filing-srv',
            'license-registry', 'voting-system', 'court-records', 'benefits-processing',
            'document-archive', 'gis-server', 'procurement-db', 'hr-records'
        ],
        workstations: [
            'clerk-terminal', 'admin-ws', 'inspector-ws', 'case-worker-ws',
            'records-ws', 'front-desk', 'supervisor-ws', 'public-kiosk'
        ],
        infrastructure: [
            'secure-gateway', 'archive-storage', 'print-server', 'backup-nas',
            'badge-reader-hub', 'cctv-server', 'mail-gateway', 'vpn-concentrator'
        ]
    },
    corporate: {
        servers: [
            'crm-database', 'erp-server', 'hr-records', 'email-server',
            'sharepoint-srv', 'sales-db', 'inventory-server', 'project-mgmt',
            'finance-db', 'marketing-cms', 'bi-analytics', 'collaboration-srv'
        ],
        workstations: [
            'exec-ws', 'sales-rep-ws', 'accounting-ws', 'hr-ws',
            'developer-ws', 'designer-ws', 'marketing-ws', 'support-ws'
        ],
        infrastructure: [
            'print-server', 'backup-nas', 'file-server', 'conference-av',
            'voip-gateway', 'wifi-controller', 'security-cam', 'badge-system'
        ]
    },
    utilities: {
        servers: [
            'scada-controller', 'grid-telemetry', 'meter-data-mgmt', 'outage-management',
            'billing-system', 'dispatch-server', 'gis-mapping', 'asset-registry',
            'demand-forecasting', 'load-balancer', 'generation-monitor', 'substation-controller'
        ],
        workstations: [
            'control-room-ws', 'dispatcher-terminal', 'field-ops-ws', 'engineering-ws',
            'billing-ws', 'customer-service-ws', 'technician-ws', 'supervisor-ws'
        ],
        infrastructure: [
            'sensor-gateway', 'rtu-controller', 'backup-generator', 'telemetry-hub',
            'comm-gateway', 'historian-server', 'alarm-aggregator', 'weather-station'
        ]
    },
    shipping: {
        servers: [
            'tracking-system', 'logistics-db', 'manifest-server', 'customs-interface',
            'route-optimizer', 'fleet-management', 'warehouse-mgmt', 'booking-server',
            'container-registry', 'freight-calculator', 'edi-gateway', 'port-interface'
        ],
        workstations: [
            'dispatcher-ws', 'warehouse-terminal', 'dock-station', 'customs-ws',
            'driver-kiosk', 'routing-ws', 'inventory-ws', 'customer-service-ws'
        ],
        infrastructure: [
            'gps-tracker', 'rfid-gateway', 'scale-controller', 'loading-bay-cam',
            'container-scanner', 'forklift-terminal', 'route-beacon', 'fuel-monitor'
        ]
    },
    emergency: {
        servers: [
            'dispatch-server', 'cad-system', 'incident-db', 'records-management',
            'avl-tracking', 'radio-controller', 'mobile-data-srv', 'gis-server',
            'resource-scheduler', 'training-records', 'equipment-tracker', 'protocol-db'
        ],
        workstations: [
            'dispatcher-console', 'call-taker-ws', 'supervisor-ws', 'records-ws',
            'mobile-terminal', 'training-ws', 'admin-ws', 'ems-station'
        ],
        infrastructure: [
            'radio-gateway', 'cad-workstation', 'backup-dispatch', 'alerting-hub',
            'station-alert', 'paging-controller', 'intercom-hub', 'ems-monitor'
        ]
    },
    nonprofit: {
        servers: [
            'donor-database', 'volunteer-mgmt', 'program-tracking', 'grants-db',
            'membership-server', 'event-management', 'fundraising-crm', 'outreach-db',
            'impact-metrics', 'newsletter-srv', 'advocacy-platform', 'case-mgmt'
        ],
        workstations: [
            'program-coord-ws', 'volunteer-ws', 'development-ws', 'admin-ws',
            'outreach-ws', 'communications-ws', 'finance-ws', 'reception-ws'
        ],
        infrastructure: [
            'file-server', 'backup-nas', 'print-server', 'donation-kiosk',
            'event-display', 'hotline-pbx', 'signup-terminal', 'inventory-tracker'
        ]
    },
    cultural: {
        servers: [
            'collection-db', 'catalog-server', 'exhibition-mgmt', 'digitization-server',
            'provenance-records', 'conservation-db', 'visitor-analytics', 'ticketing-srv',
            'loan-tracking', 'archive-server', 'media-asset-mgmt', 'research-portal'
        ],
        workstations: [
            'curator-ws', 'registrar-ws', 'conservator-ws', 'docent-terminal',
            'gift-shop-pos', 'security-station', 'education-ws', 'archives-ws'
        ],
        infrastructure: [
            'climate-monitor', 'security-camera', 'access-controller', 'audio-guide-srv',
            'exhibit-display', 'gallery-lighting', 'humidity-sensor', 'visitor-counter'
        ]
    }
};

/**
 * Get device templates for an industry
 * @param {string} industry - Industry name (banking, healthcare, etc.)
 * @returns {Object} Device templates with servers, workstations, infrastructure arrays
 */
export function getDeviceTemplates(industry) {
    return deviceTemplatesByIndustry[industry] || deviceTemplatesByIndustry.corporate;
}

/**
 * Get a random server hostname for an industry
 * @param {string} industry - Industry name
 * @param {number} index - Server index for uniqueness
 * @returns {string} Server hostname
 */
export function getRandomServerHostname(industry, index = 1) {
    const templates = getDeviceTemplates(industry);
    const server = templates.servers[Math.floor(Math.random() * templates.servers.length)];
    return `${server}-${String(index).padStart(2, '0')}`;
}

/**
 * Get a random workstation hostname for an industry
 * @param {string} industry - Industry name
 * @param {number} index - Workstation index for uniqueness
 * @returns {string} Workstation hostname
 */
export function getRandomWorkstationHostname(industry, index = 1) {
    const templates = getDeviceTemplates(industry);
    const workstation = templates.workstations[Math.floor(Math.random() * templates.workstations.length)];
    return `${workstation}-${String(index).padStart(2, '0')}`;
}

/**
 * Get a random infrastructure device hostname for an industry
 * @param {string} industry - Industry name
 * @param {number} index - Device index for uniqueness
 * @returns {string} Infrastructure hostname
 */
export function getRandomInfrastructureHostname(industry, index = 1) {
    const templates = getDeviceTemplates(industry);
    const infra = templates.infrastructure[Math.floor(Math.random() * templates.infrastructure.length)];
    return `${infra}-${String(index).padStart(2, '0')}`;
}

/**
 * Generate narrative devices for a network based on industry
 * @param {string} industry - Client industry
 * @param {number} count - Number of devices to generate
 * @param {Object} options - { includeServers, includeWorkstations, includeInfrastructure }
 * @returns {Array} Array of { hostname, type } objects
 */
export function generateNarrativeDevices(industry, count, options = {}) {
    const {
        includeServers = true,
        includeWorkstations = true,
        includeInfrastructure = true
    } = options;

    const templates = getDeviceTemplates(industry);
    const devices = [];
    const usedHostnames = new Set();

    // Build pool of available device types
    const devicePool = [];
    if (includeServers) {
        templates.servers.forEach(s => devicePool.push({ hostname: s, type: 'server' }));
    }
    if (includeWorkstations) {
        templates.workstations.forEach(w => devicePool.push({ hostname: w, type: 'workstation' }));
    }
    if (includeInfrastructure) {
        templates.infrastructure.forEach(i => devicePool.push({ hostname: i, type: 'infrastructure' }));
    }

    // Randomly select devices from pool
    let attempts = 0;
    while (devices.length < count && attempts < count * 3) {
        attempts++;
        const device = devicePool[Math.floor(Math.random() * devicePool.length)];
        const indexedHostname = `${device.hostname}-${String(devices.length + 1).padStart(2, '0')}`;

        if (!usedHostnames.has(device.hostname)) {
            usedHostnames.add(device.hostname);
            devices.push({
                hostname: indexedHostname,
                type: device.type
            });
        }
    }

    return devices;
}

/**
 * Volume name templates for multi-file system devices
 * Investigation missions require player to identify correct volume using Log Viewer
 */
export const volumeNameTemplates = {
    server: ['/data', '/logs', '/backups', '/archive', '/temp', '/system', '/users', '/shared'],
    database: ['/data', '/logs', '/backups', '/indexes', '/temp', '/archive'],
    storage: ['/vol0', '/vol1', '/vol2', '/vol3', '/backup', '/archive']
};

/**
 * Get volume names for a multi-file system device
 * @param {string} deviceType - Device type (server, database, storage)
 * @param {number} count - Number of volumes needed
 * @returns {Array<string>} Array of volume names
 */
export function getVolumeNames(deviceType, count) {
    const templates = volumeNameTemplates[deviceType] || volumeNameTemplates.server;
    return templates.slice(0, count);
}

export default {
    deviceTemplatesByIndustry,
    getDeviceTemplates,
    getRandomServerHostname,
    getRandomWorkstationHostname,
    getRandomInfrastructureHostname,
    generateNarrativeDevices,
    volumeNameTemplates,
    getVolumeNames
};
