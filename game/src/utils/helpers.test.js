import { describe, it, expect, beforeEach } from 'vitest';
import {
  generateMailId,
  generateUsername,
  formatDateTime,
  calculatePowerConsumption,
  isHardwareInstalled,
  calculateCascadePosition,
  getRandomManagerName,
  calculateChecksum,
  saveGameState,
  loadGameState,
  getAllSaves,
  deleteSave,
  hasSaves,
} from './helpers';

describe('generateMailId', () => {
  it('should generate mail ID in correct format', () => {
    const id = generateMailId();
    expect(id).toMatch(/^SNET-[A-Z0-9]{3}-[A-Z0-9]{3}-[A-Z0-9]{3}$/);
  });

  it('should generate unique IDs', () => {
    const ids = Array.from({ length: 100 }, () => generateMailId());
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBeGreaterThan(90); // Should be mostly unique
  });
});

describe('generateUsername', () => {
  it('should generate username in agent_XXXX format', () => {
    const username = generateUsername();
    expect(username).toMatch(/^agent_\d{4}$/);
  });

  it('should pad numbers with leading zeros', () => {
    const usernames = Array.from({ length: 100 }, () => generateUsername());
    usernames.forEach((username) => {
      const number = username.split('_')[1];
      expect(number).toHaveLength(4);
    });
  });
});

describe('formatDateTime', () => {
  it('should format date in dd/mm/yyyy hh:mm:ss format', () => {
    const date = new Date('2020-03-25T09:15:30');
    const formatted = formatDateTime(date);
    expect(formatted).toBe('25/03/2020 09:15:30');
  });

  it('should pad single digits with leading zeros', () => {
    const date = new Date('2020-01-05T01:02:03');
    const formatted = formatDateTime(date);
    expect(formatted).toBe('05/01/2020 01:02:03');
  });

  it('should handle midnight correctly', () => {
    const date = new Date('2020-12-31T00:00:00');
    const formatted = formatDateTime(date);
    expect(formatted).toBe('31/12/2020 00:00:00');
  });
});

describe('calculatePowerConsumption', () => {
  it('should calculate total power from all components', () => {
    const hardware = {
      cpu: { power: 65 },
      memory: [{ power: 3 }, { power: 3 }],
      storage: [{ power: 2 }],
      motherboard: { power: 5 },
      network: { power: 5 },
    };

    const total = calculatePowerConsumption(hardware);
    expect(total).toBe(83); // 65 + 3 + 3 + 2 + 5 + 5
  });

  it('should handle missing components', () => {
    const hardware = {
      cpu: { power: 65 },
      memory: [],
      storage: [],
    };

    const total = calculatePowerConsumption(hardware);
    expect(total).toBe(65);
  });

  it('should handle components without power property', () => {
    const hardware = {
      cpu: {},
      memory: [{}],
      storage: [{}],
    };

    const total = calculatePowerConsumption(hardware);
    expect(total).toBe(0);
  });
});

describe('isHardwareInstalled', () => {
  const installedHardware = {
    cpu: { id: 'cpu-1ghz' },
    memory: [{ id: 'ram-2gb' }],
    storage: [{ id: 'ssd-90gb' }],
    motherboard: { id: 'board-basic' },
    powerSupply: { id: 'psu-300w' },
    network: { id: 'net-250mb' },
  };

  it('should return true for installed CPU', () => {
    const item = { id: 'cpu-1ghz' };
    expect(isHardwareInstalled(item, installedHardware)).toBe(true);
  });

  it('should return true for installed memory', () => {
    const item = { id: 'ram-2gb' };
    expect(isHardwareInstalled(item, installedHardware)).toBe(true);
  });

  it('should return false for non-installed hardware', () => {
    const item = { id: 'cpu-2ghz' };
    expect(isHardwareInstalled(item, installedHardware)).toBe(false);
  });
});

describe('calculateCascadePosition', () => {
  it('should return base position for no existing windows', () => {
    const position = calculateCascadePosition([]);
    expect(position).toEqual({ x: 50, y: 100 });
  });

  it('should cascade position for existing windows', () => {
    const existingWindows = [
      { minimized: false },
      { minimized: false },
    ];

    const position = calculateCascadePosition(existingWindows);
    expect(position).toEqual({ x: 110, y: 160 }); // Base + 2 * 30
  });

  it('should ignore minimized windows', () => {
    const existingWindows = [
      { minimized: false },
      { minimized: true },
      { minimized: false },
    ];

    const position = calculateCascadePosition(existingWindows);
    expect(position).toEqual({ x: 110, y: 160 }); // Only 2 open windows
  });
});

describe('getRandomManagerName', () => {
  it('should return name from provided list', () => {
    const names = ['Alice', 'Bob', 'Charlie'];
    const name = getRandomManagerName(names);
    expect(names).toContain(name);
  });

  it('should return different names on multiple calls', () => {
    const names = ['Alice', 'Bob', 'Charlie', 'David', 'Eve'];
    const results = Array.from({ length: 50 }, () =>
      getRandomManagerName(names)
    );
    const uniqueResults = new Set(results);
    expect(uniqueResults.size).toBeGreaterThan(1);
  });
});

describe('calculateChecksum', () => {
  it('should generate checksum for string', () => {
    const checksum = calculateChecksum('test');
    expect(checksum).toMatch(/^[0-9A-F]{8}$/);
  });

  it('should generate consistent checksums', () => {
    const checksum1 = calculateChecksum('test');
    const checksum2 = calculateChecksum('test');
    expect(checksum1).toBe(checksum2);
  });

  it('should generate different checksums for different strings', () => {
    const checksum1 = calculateChecksum('test1');
    const checksum2 = calculateChecksum('test2');
    expect(checksum1).not.toBe(checksum2);
  });
});

describe('localStorage save/load functions', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe('saveGameState', () => {
    it('should save game state to localStorage', () => {
      const gameState = {
        username: 'agent_1234',
        currentTime: '2020-03-25T09:00:00',
        credits: 1000,
      };

      saveGameState('agent_1234', gameState);

      const saved = localStorage.getItem('sourcenet_saves');
      expect(saved).toBeTruthy();
      const parsed = JSON.parse(saved);
      expect(parsed['agent_1234']).toBeDefined();
      expect(parsed['agent_1234'][0].credits).toBe(1000);
    });

    it('should include savedAt timestamp', () => {
      const gameState = {
        username: 'agent_1234',
        currentTime: '2020-03-25T09:00:00',
      };

      const result = saveGameState('agent_1234', gameState);
      expect(result.savedAt).toBeDefined();
      expect(new Date(result.savedAt)).toBeInstanceOf(Date);
    });

    it('should auto-name save if no name provided', () => {
      const gameState = {
        username: 'agent_1234',
        currentTime: '2020-03-25T09:00:00',
      };

      const result = saveGameState('agent_1234', gameState);
      expect(result.saveName).toBeDefined();
    });

    it('should use custom save name if provided', () => {
      const gameState = {
        username: 'agent_1234',
        currentTime: '2020-03-25T09:00:00',
      };

      const result = saveGameState('agent_1234', gameState, 'MySave');
      expect(result.saveName).toBe('MySave');
    });
  });

  describe('loadGameState', () => {
    it('should load latest save for username', () => {
      // Manually create saves with different timestamps
      const saves = {
        agent_1234: [
          {
            username: 'agent_1234',
            credits: 500,
            savedAt: '2020-01-01T00:00:00.000Z',
          },
          {
            username: 'agent_1234',
            credits: 1000,
            savedAt: '2020-01-02T00:00:00.000Z',
          },
        ],
      };
      localStorage.setItem('sourcenet_saves', JSON.stringify(saves));

      const loaded = loadGameState('agent_1234');
      expect(loaded).toBeDefined();
      expect(loaded.credits).toBe(1000); // Latest save
    });

    it('should return null for non-existent username', () => {
      const loaded = loadGameState('nonexistent');
      expect(loaded).toBeNull();
    });
  });

  describe('getAllSaves', () => {
    it('should return empty object when no saves', () => {
      const saves = getAllSaves();
      expect(saves).toEqual({});
    });

    it('should return all saved games', () => {
      saveGameState('agent_1234', { username: 'agent_1234' });
      saveGameState('agent_5678', { username: 'agent_5678' });

      const saves = getAllSaves();
      expect(Object.keys(saves)).toHaveLength(2);
      expect(saves['agent_1234']).toBeDefined();
      expect(saves['agent_5678']).toBeDefined();
    });
  });

  describe('deleteSave', () => {
    it('should delete save for username', () => {
      saveGameState('agent_1234', { username: 'agent_1234' });
      saveGameState('agent_5678', { username: 'agent_5678' });

      deleteSave('agent_1234');

      const saves = getAllSaves();
      expect(saves['agent_1234']).toBeUndefined();
      expect(saves['agent_5678']).toBeDefined();
    });
  });

  describe('hasSaves', () => {
    it('should return false when no saves exist', () => {
      expect(hasSaves()).toBe(false);
    });

    it('should return true when saves exist', () => {
      saveGameState('agent_1234', { username: 'agent_1234' });
      expect(hasSaves()).toBe(true);
    });
  });

  describe('corrupted localStorage handling', () => {
    it('should return empty object when localStorage contains invalid JSON', () => {
      localStorage.setItem('sourcenet_saves', '{ invalid json }}}');
      const saves = getAllSaves();
      expect(saves).toEqual({});
    });

    it('should return empty object when localStorage contains non-object JSON', () => {
      localStorage.setItem('sourcenet_saves', '"just a string"');
      const saves = getAllSaves();
      expect(saves).toEqual({});
    });

    it('should return empty object when localStorage contains array JSON', () => {
      localStorage.setItem('sourcenet_saves', '[1, 2, 3]');
      const saves = getAllSaves();
      expect(saves).toEqual({});
    });

    it('should allow saving after corrupted data is detected', () => {
      localStorage.setItem('sourcenet_saves', '{ invalid json }}}');

      // This should not throw
      const result = saveGameState('agent_1234', { username: 'agent_1234', currentTime: '2020-03-25T09:00:00' });
      expect(result).toBeDefined();
      expect(result.username).toBe('agent_1234');

      // Verify save worked
      const saves = getAllSaves();
      expect(saves['agent_1234']).toBeDefined();
    });
  });
});
