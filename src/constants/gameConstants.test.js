import { describe, it, expect } from 'vitest';
import {
  INITIAL_MESSAGES, MANAGER_NAMES, MESSAGE_TIMING,
  SERVICES_CATALOG, SOFTWARE_CATALOG, PASSWORD_HASH_TYPES, CPU_CRACK_MULTIPLIERS,
} from './gameConstants';

describe('Game Constants', () => {
  it('should have correct initial message configuration', () => {
    expect(INITIAL_MESSAGES).toHaveLength(1);

    const hrMessage = INITIAL_MESSAGES[0];
    expect(hrMessage.id).toBe('msg-welcome-hr');
    expect(hrMessage.from).toBe('SourceNet Human Resources');
    expect(hrMessage.fromId).toBe('SNET-HQ0-000-001');
    expect(hrMessage.subject).toBe('Welcome to SourceNet!');
    expect(hrMessage.body).toContain('securing the global internet space');
    expect(hrMessage.read).toBe(false);
    expect(hrMessage.archived).toBe(false);
  });

  it('should have manager names available for random selection', () => {
    expect(MANAGER_NAMES).toBeInstanceOf(Array);
    expect(MANAGER_NAMES.length).toBeGreaterThan(0);
    expect(MANAGER_NAMES).toContain('Alex');
    expect(MANAGER_NAMES).toContain('Jordan');
  });

  it('should have correct message timing configuration', () => {
    expect(MESSAGE_TIMING.FIRST_MESSAGE_DELAY).toBe(2000);
    expect(MESSAGE_TIMING.SECOND_MESSAGE_DELAY).toBe(2000);
  });
});

describe('Services and Software Catalog', () => {
  it('should have relay-service-standard at 30000 credits', () => {
    const relay = SERVICES_CATALOG.find(s => s.id === 'relay-service-standard');
    expect(relay).toBeDefined();
    expect(relay.price).toBe(30000);
    expect(relay.oneTimePurchase).toBe(true);
  });

  it('should have network-sniffer at 50000 credits', () => {
    const sniffer = SOFTWARE_CATALOG.find(s => s.id === 'network-sniffer');
    expect(sniffer).toBeDefined();
    expect(sniffer.price).toBe(50000);
  });

  it('should have trace-monitor in software catalog', () => {
    const monitor = SOFTWARE_CATALOG.find(s => s.id === 'trace-monitor');
    expect(monitor).toBeDefined();
    expect(monitor.passive).toBe(true);
  });

  it('should have vpn-relay-upgrade in software catalog', () => {
    const relay = SOFTWARE_CATALOG.find(s => s.id === 'vpn-relay-upgrade');
    expect(relay).toBeDefined();
    expect(relay.requiresUnlock).toBe('relay-service');
  });
});

describe('Password Cracking Constants', () => {
  it('should have PASSWORD_HASH_TYPES with expected hash types', () => {
    expect(PASSWORD_HASH_TYPES).toBeDefined();
    expect(PASSWORD_HASH_TYPES.md5).toBeDefined();
    expect(PASSWORD_HASH_TYPES.sha256).toBeDefined();
    expect(PASSWORD_HASH_TYPES.bcrypt).toBeDefined();
    expect(PASSWORD_HASH_TYPES.bcrypt.bruteForceOnly).toBe(true);
    expect(PASSWORD_HASH_TYPES.md5.dictionaryEffective).toBe(true);
  });

  it('should have CPU_CRACK_MULTIPLIERS with expected entries', () => {
    expect(CPU_CRACK_MULTIPLIERS).toBeDefined();
    expect(CPU_CRACK_MULTIPLIERS['cpu-1ghz-single']).toBe(1);
    expect(CPU_CRACK_MULTIPLIERS['cpu-4ghz-quad']).toBe(12);
    expect(Object.keys(CPU_CRACK_MULTIPLIERS).length).toBeGreaterThanOrEqual(4);
  });
});
