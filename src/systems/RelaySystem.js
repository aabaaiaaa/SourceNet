/**
 * RelaySystem - Manages relay node generation, suspicion tracking, and trace calculation
 *
 * Relay nodes are used by the VPN Client to anonymize connections.
 * Each node has bandwidth, anonymity rating, cost, and suspicion level.
 * Suspicion accumulates with use; maxed-out nodes are "burned" (unusable).
 */

import { RELAY_DEFAULTS } from '../constants/gameConstants';

// Relay node name pools
const RELAY_LOCATIONS = [
  'Amsterdam', 'Tokyo', 'São Paulo', 'Singapore', 'Frankfurt',
  'Sydney', 'Toronto', 'Mumbai', 'Stockholm', 'Johannesburg',
  'Seoul', 'Dubai', 'Dublin', 'Zurich', 'Buenos Aires',
  'Oslo', 'Taipei', 'Helsinki', 'Warsaw', 'Bangkok',
];

const RELAY_PROVIDERS = [
  'GhostRoute', 'ShadowLink', 'NullPath', 'DarkTunnel', 'PhantomProxy',
  'VoidHop', 'StealthNet', 'ZeroTrace', 'BlackMirror', 'CipherNode',
];

/**
 * Generate initial relay nodes
 * @param {number} count - Number of nodes to generate
 * @returns {Array} Array of relay node objects
 */
export const generateRelayNodes = (count = RELAY_DEFAULTS.initialNodeCount) => {
  const nodes = [];
  const usedLocations = new Set();

  for (let i = 0; i < count; i++) {
    // Pick unique location
    let location;
    do {
      location = RELAY_LOCATIONS[Math.floor(Math.random() * RELAY_LOCATIONS.length)];
    } while (usedLocations.has(location) && usedLocations.size < RELAY_LOCATIONS.length);
    usedLocations.add(location);

    const provider = RELAY_PROVIDERS[Math.floor(Math.random() * RELAY_PROVIDERS.length)];

    nodes.push({
      id: `relay-${i}-${Date.now()}`,
      name: `${provider} - ${location}`,
      location,
      bandwidth: 20 + Math.floor(Math.random() * 80), // 20-100 Mbps
      anonymityRating: 0.5 + Math.random() * 0.5, // 0.5-1.0
      costPerUse: 100 + Math.floor(Math.random() * 400), // 100-500 credits
      suspicion: 0,
      burned: false,
    });
  }

  return nodes;
};

/**
 * Generate a single replacement relay node
 * @returns {object} New relay node
 */
export const generateReplacementNode = () => {
  const location = RELAY_LOCATIONS[Math.floor(Math.random() * RELAY_LOCATIONS.length)];
  const provider = RELAY_PROVIDERS[Math.floor(Math.random() * RELAY_PROVIDERS.length)];

  return {
    id: `relay-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
    name: `${provider} - ${location}`,
    location,
    bandwidth: 20 + Math.floor(Math.random() * 80),
    anonymityRating: 0.5 + Math.random() * 0.5,
    costPerUse: 100 + Math.floor(Math.random() * 400),
    suspicion: 0,
    burned: false,
  };
};

/**
 * Calculate total cost of a relay chain
 * @param {Array} selectedNodeIds - Ordered array of relay node IDs
 * @param {Array} allNodes - All available relay nodes
 * @returns {number} Total cost
 */
export const calculateChainCost = (selectedNodeIds, allNodes) => {
  return selectedNodeIds.reduce((total, nodeId) => {
    const node = allNodes.find(n => n.id === nodeId);
    return total + (node?.costPerUse || 0);
  }, 0);
};

/**
 * Calculate bandwidth bottleneck for a relay chain
 * @param {Array} selectedNodeIds - Ordered array of relay node IDs
 * @param {Array} allNodes - All available relay nodes
 * @returns {number} Minimum bandwidth in the chain (Mbps)
 */
export const calculateChainBandwidth = (selectedNodeIds, allNodes) => {
  if (selectedNodeIds.length === 0) return 0;

  let minBandwidth = Infinity;
  for (const nodeId of selectedNodeIds) {
    const node = allNodes.find(n => n.id === nodeId);
    if (node) {
      minBandwidth = Math.min(minBandwidth, node.bandwidth);
    }
  }

  return minBandwidth === Infinity ? 0 : minBandwidth;
};

/**
 * Calculate estimated time-to-traced (ETT) for a relay chain
 * @param {Array} selectedNodeIds - Ordered array of relay node IDs
 * @param {Array} allNodes - All available relay nodes
 * @returns {number} ETT in milliseconds (game time)
 */
export const calculateETT = (selectedNodeIds, allNodes) => {
  if (selectedNodeIds.length === 0) return 0;

  let totalETT = 0;
  for (const nodeId of selectedNodeIds) {
    const node = allNodes.find(n => n.id === nodeId);
    if (node) {
      // Higher anonymity = more time to trace through this node
      totalETT += RELAY_DEFAULTS.baseETTMs * node.anonymityRating;
    }
  }

  return Math.floor(totalETT);
};

/**
 * Apply suspicion to relay nodes after a connection is used
 * Front nodes accumulate suspicion faster
 * @param {Array} selectedNodeIds - Ordered array of relay node IDs in chain
 * @param {Array} allNodes - All relay nodes
 * @returns {Array} Updated relay nodes array
 */
export const applySuspicion = (selectedNodeIds, allNodes) => {
  return allNodes.map(node => {
    const chainIndex = selectedNodeIds.indexOf(node.id);
    if (chainIndex === -1) return node;

    // Front node gets multiplied suspicion
    const multiplier = chainIndex === 0 ? RELAY_DEFAULTS.frontNodeSuspicionMultiplier : 1;
    const suspicionGain = Math.floor(RELAY_DEFAULTS.suspicionPerUse * multiplier);
    const newSuspicion = Math.min(RELAY_DEFAULTS.maxSuspicion, node.suspicion + suspicionGain);
    const burned = newSuspicion >= RELAY_DEFAULTS.maxSuspicion;

    return { ...node, suspicion: newSuspicion, burned };
  });
};

/**
 * Burn all relay nodes in a chain (when player is traced)
 * @param {Array} selectedNodeIds - Ordered array of relay node IDs
 * @param {Array} allNodes - All relay nodes
 * @returns {Array} Updated relay nodes with burned chain
 */
export const burnChain = (selectedNodeIds, allNodes) => {
  return allNodes.map(node => {
    if (selectedNodeIds.includes(node.id)) {
      return { ...node, suspicion: RELAY_DEFAULTS.maxSuspicion, burned: true };
    }
    return node;
  });
};

/**
 * Get count of available (non-burned) relay nodes
 * @param {Array} nodes - All relay nodes
 * @returns {number} Count of usable nodes
 */
export const getAvailableNodeCount = (nodes) => {
  return nodes.filter(n => !n.burned).length;
};

/**
 * Format ETT for display (e.g., "2:30" for 2 minutes 30 seconds)
 * @param {number} ettMs - ETT in milliseconds
 * @returns {string} Formatted ETT
 */
export const formatETT = (ettMs) => {
  const totalSeconds = Math.floor(ettMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
};
