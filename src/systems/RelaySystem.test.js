import { describe, it, expect } from 'vitest';
import {
  generateRelayNodes,
  generateReplacementNode,
  calculateChainCost,
  calculateChainBandwidth,
  calculateETT,
  applySuspicion,
  burnChain,
  getAvailableNodeCount,
  formatETT,
} from './RelaySystem';
import { RELAY_DEFAULTS } from '../constants/gameConstants';

describe('RelaySystem', () => {
  // Helper to create predictable relay nodes for testing
  const makeNodes = (overrides = []) => [
    { id: 'relay-a', name: 'GhostRoute - Amsterdam', location: 'Amsterdam', bandwidth: 50, anonymityRating: 0.8, costPerUse: 200, suspicion: 0, burned: false },
    { id: 'relay-b', name: 'ShadowLink - Tokyo', location: 'Tokyo', bandwidth: 30, anonymityRating: 0.6, costPerUse: 300, suspicion: 0, burned: false },
    { id: 'relay-c', name: 'NullPath - Singapore', location: 'Singapore', bandwidth: 80, anonymityRating: 0.9, costPerUse: 150, suspicion: 0, burned: false },
    ...overrides,
  ];

  describe('generateRelayNodes', () => {
    it('should generate the default number of nodes', () => {
      const nodes = generateRelayNodes();
      expect(nodes).toHaveLength(RELAY_DEFAULTS.initialNodeCount);
    });

    it('should generate a custom number of nodes', () => {
      const nodes = generateRelayNodes(3);
      expect(nodes).toHaveLength(3);
    });

    it('should create nodes with all required properties', () => {
      const nodes = generateRelayNodes(1);
      const node = nodes[0];
      expect(node.id).toBeDefined();
      expect(node.name).toBeDefined();
      expect(node.location).toBeDefined();
      expect(typeof node.bandwidth).toBe('number');
      expect(typeof node.anonymityRating).toBe('number');
      expect(typeof node.costPerUse).toBe('number');
      expect(node.suspicion).toBe(0);
      expect(node.burned).toBe(false);
    });

    it('should generate bandwidth between 20 and 99', () => {
      const nodes = generateRelayNodes(20);
      for (const node of nodes) {
        expect(node.bandwidth).toBeGreaterThanOrEqual(20);
        expect(node.bandwidth).toBeLessThan(100);
      }
    });

    it('should generate anonymity rating between 0.5 and 1.0', () => {
      const nodes = generateRelayNodes(20);
      for (const node of nodes) {
        expect(node.anonymityRating).toBeGreaterThanOrEqual(0.5);
        expect(node.anonymityRating).toBeLessThan(1.0);
      }
    });

    it('should generate cost between 100 and 499', () => {
      const nodes = generateRelayNodes(20);
      for (const node of nodes) {
        expect(node.costPerUse).toBeGreaterThanOrEqual(100);
        expect(node.costPerUse).toBeLessThan(500);
      }
    });

    it('should generate unique locations when possible', () => {
      const nodes = generateRelayNodes(6);
      const locations = nodes.map(n => n.location);
      const uniqueLocations = new Set(locations);
      expect(uniqueLocations.size).toBe(6);
    });

    it('should have unique IDs', () => {
      const nodes = generateRelayNodes(6);
      const ids = new Set(nodes.map(n => n.id));
      expect(ids.size).toBe(6);
    });
  });

  describe('generateReplacementNode', () => {
    it('should create a single node with all required properties', () => {
      const node = generateReplacementNode();
      expect(node.id).toBeDefined();
      expect(node.name).toBeDefined();
      expect(node.location).toBeDefined();
      expect(node.bandwidth).toBeGreaterThanOrEqual(20);
      expect(node.anonymityRating).toBeGreaterThanOrEqual(0.5);
      expect(node.costPerUse).toBeGreaterThanOrEqual(100);
      expect(node.suspicion).toBe(0);
      expect(node.burned).toBe(false);
    });
  });

  describe('calculateChainCost', () => {
    it('should return 0 for empty chain', () => {
      expect(calculateChainCost([], makeNodes())).toBe(0);
    });

    it('should return cost of single node', () => {
      expect(calculateChainCost(['relay-a'], makeNodes())).toBe(200);
    });

    it('should sum costs of multiple nodes', () => {
      expect(calculateChainCost(['relay-a', 'relay-b'], makeNodes())).toBe(500);
    });

    it('should sum costs of all three nodes', () => {
      expect(calculateChainCost(['relay-a', 'relay-b', 'relay-c'], makeNodes())).toBe(650);
    });

    it('should skip missing node IDs', () => {
      expect(calculateChainCost(['relay-a', 'relay-missing'], makeNodes())).toBe(200);
    });
  });

  describe('calculateChainBandwidth', () => {
    it('should return 0 for empty chain', () => {
      expect(calculateChainBandwidth([], makeNodes())).toBe(0);
    });

    it('should return bandwidth of single node', () => {
      expect(calculateChainBandwidth(['relay-a'], makeNodes())).toBe(50);
    });

    it('should return minimum bandwidth in chain (bottleneck)', () => {
      // relay-a: 50, relay-b: 30, relay-c: 80 -> bottleneck is 30
      expect(calculateChainBandwidth(['relay-a', 'relay-b', 'relay-c'], makeNodes())).toBe(30);
    });

    it('should handle chain where first node is bottleneck', () => {
      expect(calculateChainBandwidth(['relay-b', 'relay-c'], makeNodes())).toBe(30);
    });

    it('should handle chain where last node is bottleneck', () => {
      expect(calculateChainBandwidth(['relay-c', 'relay-a', 'relay-b'], makeNodes())).toBe(30);
    });
  });

  describe('calculateETT', () => {
    it('should return 0 for empty chain', () => {
      expect(calculateETT([], makeNodes())).toBe(0);
    });

    it('should calculate ETT based on anonymity rating', () => {
      // relay-a has anonymityRating 0.8, baseETTMs = 120000
      // ETT = 120000 * 0.8 = 96000
      expect(calculateETT(['relay-a'], makeNodes())).toBe(96000);
    });

    it('should sum ETT across multiple nodes', () => {
      // relay-a: 120000 * 0.8 = 96000
      // relay-b: 120000 * 0.6 = 72000
      // Total: 168000
      expect(calculateETT(['relay-a', 'relay-b'], makeNodes())).toBe(168000);
    });

    it('should increase ETT with more relay nodes', () => {
      const oneNode = calculateETT(['relay-a'], makeNodes());
      const twoNodes = calculateETT(['relay-a', 'relay-b'], makeNodes());
      const threeNodes = calculateETT(['relay-a', 'relay-b', 'relay-c'], makeNodes());
      expect(twoNodes).toBeGreaterThan(oneNode);
      expect(threeNodes).toBeGreaterThan(twoNodes);
    });

    it('should produce higher ETT for high-anonymity nodes', () => {
      // relay-c has 0.9 rating vs relay-b with 0.6
      const highAnon = calculateETT(['relay-c'], makeNodes());
      const lowAnon = calculateETT(['relay-b'], makeNodes());
      expect(highAnon).toBeGreaterThan(lowAnon);
    });
  });

  describe('applySuspicion', () => {
    it('should not modify nodes not in the chain', () => {
      const nodes = makeNodes();
      const updated = applySuspicion(['relay-a'], nodes);
      const nodeB = updated.find(n => n.id === 'relay-b');
      const nodeC = updated.find(n => n.id === 'relay-c');
      expect(nodeB.suspicion).toBe(0);
      expect(nodeC.suspicion).toBe(0);
    });

    it('should apply base suspicion to non-front nodes', () => {
      const nodes = makeNodes();
      const updated = applySuspicion(['relay-a', 'relay-b'], nodes);
      const nodeB = updated.find(n => n.id === 'relay-b');
      expect(nodeB.suspicion).toBe(RELAY_DEFAULTS.suspicionPerUse);
    });

    it('should apply multiplied suspicion to front node', () => {
      const nodes = makeNodes();
      const updated = applySuspicion(['relay-a', 'relay-b'], nodes);
      const nodeA = updated.find(n => n.id === 'relay-a');
      const expectedSuspicion = Math.floor(RELAY_DEFAULTS.suspicionPerUse * RELAY_DEFAULTS.frontNodeSuspicionMultiplier);
      expect(nodeA.suspicion).toBe(expectedSuspicion);
    });

    it('should accumulate suspicion across multiple uses', () => {
      let nodes = makeNodes();
      nodes = applySuspicion(['relay-b'], nodes);
      nodes = applySuspicion(['relay-b'], nodes);
      const nodeB = nodes.find(n => n.id === 'relay-b');
      // Front node each time: 15 * 2.5 = 37 (floored), twice = 74
      const expectedPerUse = Math.floor(RELAY_DEFAULTS.suspicionPerUse * RELAY_DEFAULTS.frontNodeSuspicionMultiplier);
      expect(nodeB.suspicion).toBe(expectedPerUse * 2);
    });

    it('should cap suspicion at maxSuspicion', () => {
      const nodes = makeNodes([]);
      // Set suspicion close to max
      nodes[0].suspicion = 95;
      const updated = applySuspicion(['relay-a'], nodes);
      const nodeA = updated.find(n => n.id === 'relay-a');
      expect(nodeA.suspicion).toBe(RELAY_DEFAULTS.maxSuspicion);
    });

    it('should burn node when suspicion reaches max', () => {
      const nodes = makeNodes();
      nodes[0].suspicion = 90;
      const updated = applySuspicion(['relay-a'], nodes);
      const nodeA = updated.find(n => n.id === 'relay-a');
      expect(nodeA.burned).toBe(true);
    });

    it('should not burn node when suspicion stays below max', () => {
      const nodes = makeNodes();
      const updated = applySuspicion(['relay-b'], nodes);
      const nodeB = updated.find(n => n.id === 'relay-b');
      expect(nodeB.burned).toBe(false);
    });
  });

  describe('burnChain', () => {
    it('should burn all nodes in the chain', () => {
      const nodes = makeNodes();
      const updated = burnChain(['relay-a', 'relay-b'], nodes);
      expect(updated.find(n => n.id === 'relay-a').burned).toBe(true);
      expect(updated.find(n => n.id === 'relay-b').burned).toBe(true);
      expect(updated.find(n => n.id === 'relay-a').suspicion).toBe(RELAY_DEFAULTS.maxSuspicion);
      expect(updated.find(n => n.id === 'relay-b').suspicion).toBe(RELAY_DEFAULTS.maxSuspicion);
    });

    it('should not affect nodes outside the chain', () => {
      const nodes = makeNodes();
      const updated = burnChain(['relay-a'], nodes);
      expect(updated.find(n => n.id === 'relay-b').burned).toBe(false);
      expect(updated.find(n => n.id === 'relay-c').burned).toBe(false);
    });

    it('should burn entire chain on trace', () => {
      const nodes = makeNodes();
      const updated = burnChain(['relay-a', 'relay-b', 'relay-c'], nodes);
      for (const node of updated) {
        expect(node.burned).toBe(true);
        expect(node.suspicion).toBe(RELAY_DEFAULTS.maxSuspicion);
      }
    });
  });

  describe('getAvailableNodeCount', () => {
    it('should count all nodes when none are burned', () => {
      expect(getAvailableNodeCount(makeNodes())).toBe(3);
    });

    it('should exclude burned nodes', () => {
      const nodes = makeNodes();
      nodes[0].burned = true;
      expect(getAvailableNodeCount(nodes)).toBe(2);
    });

    it('should return 0 when all nodes are burned', () => {
      const nodes = makeNodes().map(n => ({ ...n, burned: true }));
      expect(getAvailableNodeCount(nodes)).toBe(0);
    });

    it('should return 0 for empty array', () => {
      expect(getAvailableNodeCount([])).toBe(0);
    });
  });

  describe('formatETT', () => {
    it('should format seconds correctly', () => {
      expect(formatETT(30000)).toBe('0:30');
    });

    it('should format minutes and seconds', () => {
      expect(formatETT(150000)).toBe('2:30');
    });

    it('should zero-pad single-digit seconds', () => {
      expect(formatETT(65000)).toBe('1:05');
    });

    it('should format zero', () => {
      expect(formatETT(0)).toBe('0:00');
    });

    it('should format large values', () => {
      expect(formatETT(600000)).toBe('10:00');
    });
  });
});
