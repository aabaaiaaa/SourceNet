import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { GameContext } from '../../contexts/GameContext';
import MissionBoard from './MissionBoard';

// Create a custom provider for testing with specific context values
const createTestContext = (overrides = {}) => ({
  gamePhase: 'playing',
  currentTime: new Date('2026-01-26T12:00:00'),
  availableMissions: [],
  activeMission: null,
  completedMissions: [],
  missionFileOperations: {},
  playerReputation: 50,
  setActiveMission: vi.fn(),
  setAvailableMissions: vi.fn(),
  setCompletedMissions: vi.fn(),
  ...overrides,
});

const renderWithContext = (component, contextOverrides = {}) => {
  const contextValue = createTestContext(contextOverrides);
  return render(
    <GameContext.Provider value={contextValue}>
      {component}
    </GameContext.Provider>
  );
};

describe('MissionBoard Component', () => {
  it('should render app title', () => {
    renderWithContext(<MissionBoard />);
    expect(screen.getByText('SourceNet Mission Board')).toBeInTheDocument();
  });

  it('should have three tabs', () => {
    renderWithContext(<MissionBoard />);
    expect(screen.getByText('Available Missions')).toBeInTheDocument();
    expect(screen.getByText('Active Mission')).toBeInTheDocument();
    expect(screen.getByText('Completed')).toBeInTheDocument();
  });

  it('should show empty state when no missions', () => {
    renderWithContext(<MissionBoard />);
    expect(screen.getByText(/No missions currently available/i)).toBeInTheDocument();
  });

  it('should show subtitle', () => {
    renderWithContext(<MissionBoard />);
    expect(screen.getByText('Ethical Hacking Contracts')).toBeInTheDocument();
  });

  describe('file checklist display', () => {
    const createMissionWithFileObjective = (objectiveOverrides = {}, _missionFileOps = {}) => ({
      missionId: 'test-mission-1',
      title: 'Test File Mission',
      client: 'TestClient',
      status: 'active',
      objectives: [
        {
          id: 'obj-1',
          type: 'fileOperation',
          operation: 'paste',
          description: 'Paste files to destination',
          status: 'pending',
          targetFiles: ['file1.txt', 'file2.txt', 'file3.txt'],
          destination: '192.168.50.20',
          ...objectiveOverrides,
        },
      ],
    });

    it('should display file checklist for pending file operation objective', () => {
      const mission = createMissionWithFileObjective();
      renderWithContext(<MissionBoard />, {
        activeMission: mission,
        missionFileOperations: {},
      });

      // Click on Active Mission tab
      fireEvent.click(screen.getByText('Active Mission'));

      // Should show destination
      expect(screen.getByText('Destination: 192.168.50.20')).toBeInTheDocument();

      // Should show all target files
      expect(screen.getByText('file1.txt')).toBeInTheDocument();
      expect(screen.getByText('file2.txt')).toBeInTheDocument();
      expect(screen.getByText('file3.txt')).toBeInTheDocument();
    });

    it('should mark completed files with checkmark', () => {
      const mission = createMissionWithFileObjective();
      renderWithContext(<MissionBoard />, {
        activeMission: mission,
        missionFileOperations: {
          paste: new Set(['file1.txt']),
          pasteDestinations: new Map([['file1.txt', '192.168.50.20']]),
        },
      });

      fireEvent.click(screen.getByText('Active Mission'));

      // file1.txt should be in a completed file-item
      const file1Element = screen.getByText('file1.txt').closest('.file-item');
      expect(file1Element).toHaveClass('file-complete');

      // file2.txt should not be completed
      const file2Element = screen.getByText('file2.txt').closest('.file-item');
      expect(file2Element).not.toHaveClass('file-complete');
    });

    it('should show warning for files pasted to wrong location', () => {
      const mission = createMissionWithFileObjective();
      renderWithContext(<MissionBoard />, {
        activeMission: mission,
        missionFileOperations: {
          paste: new Set(['file2.txt']),
          pasteDestinations: new Map([['file2.txt', '192.168.99.99']]), // Wrong destination
        },
      });

      fireEvent.click(screen.getByText('Active Mission'));

      // file2.txt should have wrong-location class
      const file2Element = screen.getByText('file2.txt').closest('.file-item');
      expect(file2Element).toHaveClass('file-wrong-location');

      // Should show warning emoji
      expect(file2Element.querySelector('.file-warning')).toBeInTheDocument();
    });

    it('should not show file checklist for completed objectives', () => {
      const mission = createMissionWithFileObjective({ status: 'complete' });
      renderWithContext(<MissionBoard />, {
        activeMission: mission,
        missionFileOperations: {
          paste: new Set(['file1.txt', 'file2.txt', 'file3.txt']),
          pasteDestinations: new Map([
            ['file1.txt', '192.168.50.20'],
            ['file2.txt', '192.168.50.20'],
            ['file3.txt', '192.168.50.20'],
          ]),
        },
      });

      fireEvent.click(screen.getByText('Active Mission'));

      // File checklist should not be shown for completed objectives
      expect(screen.queryByText('Destination: 192.168.50.20')).not.toBeInTheDocument();
    });

    it('should show progress indicator with correct count', () => {
      const mission = createMissionWithFileObjective();
      renderWithContext(<MissionBoard />, {
        activeMission: mission,
        missionFileOperations: {
          paste: new Set(['file1.txt', 'file2.txt']),
          pasteDestinations: new Map([
            ['file1.txt', '192.168.50.20'],
            ['file2.txt', '192.168.50.20'],
          ]),
        },
      });

      fireEvent.click(screen.getByText('Active Mission'));

      // Should show progress (2/3)
      expect(screen.getByText('(2/3)')).toBeInTheDocument();
    });

    it('should not show file checklist for objectives without targetFiles', () => {
      const mission = {
        missionId: 'test-mission-2',
        title: 'Test Mission',
        client: 'TestClient',
        status: 'active',
        objectives: [
          {
            id: 'obj-1',
            type: 'networkConnection',
            description: 'Connect to network',
            status: 'pending',
            target: 'test-network',
          },
        ],
      };

      renderWithContext(<MissionBoard />, { activeMission: mission });

      fireEvent.click(screen.getByText('Active Mission'));

      // Should not show file checklist elements
      expect(screen.queryByText(/Destination:/)).not.toBeInTheDocument();
      expect(screen.queryByTestId('file-checklist')).not.toBeInTheDocument();
      // Verify there's no file-list class element
      expect(document.querySelector('.file-list')).not.toBeInTheDocument();
    });
  });

  describe('submit for completion button', () => {
    it('should show submit button when all required objectives complete but optional remain (data-detective scenario)', () => {
      const mission = {
        missionId: 'data-detective',
        title: 'The Missing Archives',
        client: 'Westbrook Public Library',
        status: 'active',
        objectives: [
          { id: 'obj-nar', type: 'narEntryAdded', description: 'Add credentials', status: 'complete' },
          { id: 'obj-connect', type: 'networkConnection', description: 'Connect to network', status: 'complete' },
          { id: 'obj-scan', type: 'networkScan', description: 'Scan network', status: 'complete' },
          { id: 'obj-drt-connect', type: 'fileSystemConnection', description: 'Connect DRT', status: 'complete' },
          { id: 'obj-drt-scan', type: 'dataRecoveryScan', description: 'Scan for deleted', status: 'complete' },
          { id: 'obj-recover-files', type: 'fileRecovery', description: 'Recover files', status: 'complete' },
          { id: 'obj-investigate', type: 'investigation', description: 'View logs', status: 'complete' },
          { id: 'obj-periodicals-scan', type: 'dataRecoveryScan', description: 'Scan periodicals', status: 'pending', required: false, bonusPayout: 250 },
          { id: 'obj-periodicals-recover', type: 'fileRecovery', description: 'Recover periodicals', status: 'pending', required: false, bonusPayout: 250 },
          { id: 'obj-verify', type: 'verification', description: 'Verify mission completion', status: 'pending', autoComplete: false },
        ],
      };

      const submitFn = vi.fn();
      renderWithContext(<MissionBoard />, {
        activeMission: mission,
        submitMissionForCompletion: submitFn,
      });

      fireEvent.click(screen.getByText('Active Mission'));

      expect(screen.getByText('Submit for Completion')).toBeInTheDocument();
      expect(screen.getByText(/All required objectives complete/)).toBeInTheDocument();
    });
  });
});
