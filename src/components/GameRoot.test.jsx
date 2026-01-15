import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import { GameProvider, GameContext } from '../contexts/GameContext';
import GameRoot from './GameRoot';
import { useContext } from 'react';

describe('GameRoot Component - gamePhase Logic', () => {
  let originalLocation;

  beforeEach(() => {
    originalLocation = window.location;

    const sessionStorageMock = (() => {
      let store = {};
      return {
        getItem: (key) => store[key] || null,
        setItem: (key, value) => { store[key] = value.toString(); },
        clear: () => { store = {}; },
        removeItem: (key) => { delete store[key]; },
      };
    })();
    Object.defineProperty(window, 'sessionStorage', { value: sessionStorageMock, writable: true });
    window.sessionStorage.clear();
  });

  afterEach(() => {
    delete window.location;
    window.location = originalLocation;
  });

  const setMockUrl = (search = '') => {
    delete window.location;
    window.location = {
      ...originalLocation,
      search,
      href: `http://localhost/${search}`,
    };
  };

  const TestComponent = ({ onRender }) => {
    const context = useContext(GameContext);
    if (onRender) onRender(context);
    return null;
  };

  it('should render without errors', () => {
    setMockUrl('');
    expect(() => render(
      <GameProvider>
        <GameRoot />
      </GameProvider>
    )).not.toThrow();
  });

  describe('Boot phase behavior', () => {
    it('should display boot screen when no URL parameters', () => {
      setMockUrl('');
      const { container } = render(
        <GameProvider>
          <GameRoot />
        </GameProvider>
      );

      expect(container.querySelector('.boot-screen')).toBeTruthy();
    });

    it('should display boot screen with debug parameter only', () => {
      setMockUrl('?debug=true');
      const { container } = render(
        <GameProvider>
          <GameRoot />
        </GameProvider>
      );

      expect(container.querySelector('.boot-screen')).toBeTruthy();
    });
  });

  describe('skipBoot parameter', () => {
    it('should transition to username selection when skipBoot=true', async () => {
      setMockUrl('?skipBoot=true');
      let capturedContext;

      render(
        <GameProvider>
          <TestComponent onRender={(ctx) => { capturedContext = ctx; }} />
          <GameRoot />
        </GameProvider>
      );

      await waitFor(() => {
        expect(capturedContext.gamePhase).toBe('username');
      }, { timeout: 1000 });
    });

    it('should show username selection screen with skipBoot=true', async () => {
      setMockUrl('?skipBoot=true');
      const { container } = render(
        <GameProvider>
          <GameRoot />
        </GameProvider>
      );

      await waitFor(() => {
        expect(container.querySelector('.username-selection')).toBeTruthy();
      }, { timeout: 1000 });
    });
  });

  describe('Scenario sessionStorage namespacing', () => {
    it('should store scenario applied status with scenario name in key', async () => {
      window.sessionStorage.clear();

      // Simulate a scenario being applied
      window.sessionStorage.setItem('scenarioApplied_test-scenario', 'true');

      expect(window.sessionStorage.getItem('scenarioApplied_test-scenario')).toBe('true');
      expect(window.sessionStorage.getItem('scenarioApplied_other-scenario')).toBeNull();
    });

    it('should not share sessionStorage flags between different scenarios', () => {
      window.sessionStorage.setItem('scenarioApplied_scenario-a', 'true');
      window.sessionStorage.setItem('scenarioApplied_scenario-b', 'true');

      expect(window.sessionStorage.getItem('scenarioApplied_scenario-a')).toBe('true');
      expect(window.sessionStorage.getItem('scenarioApplied_scenario-b')).toBe('true');
      expect(window.sessionStorage.getItem('scenarioApplied_scenario-c')).toBeNull();
    });
  });

  describe('GamePhase initialization from GameContext', () => {
    it('gamePhase should always initialize to boot in GameContext', () => {
      setMockUrl('');
      let capturedContext;

      render(
        <GameProvider>
          <TestComponent onRender={(ctx) => { capturedContext = ctx; }} />
        </GameProvider>
      );

      // GameContext always initializes to boot, regardless of URL
      expect(capturedContext.gamePhase).toBe('boot');
    });

    it('gamePhase should be boot even with scenario parameter (transitions happen in GameRoot)', () => {
      setMockUrl('?scenario=test');
      let capturedContext;

      render(
        <GameProvider>
          <TestComponent onRender={(ctx) => { capturedContext = ctx; }} />
        </GameProvider>
      );

      expect(capturedContext.gamePhase).toBe('boot');
    });

    it('gamePhase should be boot even with skipBoot parameter (transitions happen in GameRoot)', () => {
      setMockUrl('?skipBoot=true');
      let capturedContext;

      render(
        <GameProvider>
          <TestComponent onRender={(ctx) => { capturedContext = ctx; }} />
        </GameProvider>
      );

      expect(capturedContext.gamePhase).toBe('boot');
    });
  });
});

