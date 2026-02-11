import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { GameProvider } from '../../contexts/GameContext';
import { useGame } from '../../contexts/useGame';
import TopBar from '../../components/ui/TopBar';
import networkRegistry from '../../systems/NetworkRegistry';

// Helper component to access context
const TestComponent = ({ onRender }) => {
  const game = useGame();
  if (onRender) onRender(game);
  return null;
};

const renderWithProvider = (onRender) => {
  return render(
    <GameProvider>
      <TopBar />
      <TestComponent onRender={onRender} />
    </GameProvider>
  );
};

describe('Bandwidth Info Integration', () => {
  beforeEach(() => {
    networkRegistry.reset();
  });

  afterEach(() => {
    networkRegistry.reset();
  });

  describe('Adapter Speed Display', () => {
    it('should show "Total: 31.3 MB/s" for default adapter', async () => {
      renderWithProvider();

      const indicator = document.querySelector('.topbar-bandwidth');
      fireEvent.mouseEnter(indicator);

      await waitFor(() => {
        expect(screen.getByText(/Total: 31.3 MB\/s/)).toBeInTheDocument();
      });
    });

    it('should show total 31.3 MB/s for default 250Mb adapter', async () => {
      renderWithProvider();

      const indicator = document.querySelector('.topbar-bandwidth');
      fireEvent.mouseEnter(indicator);

      await waitFor(() => {
        expect(screen.getByText(/Total: 31.3 MB\/s/)).toBeInTheDocument();
      });
    });

    it('should show "Total: 62.5 MB/s" after 500Mbps upgrade', async () => {
      let setHardware;
      renderWithProvider((game) => {
        setHardware = game.setHardware;
      });

      act(() => {
        setHardware(prev => ({
          ...prev,
          network: {
            id: 'net-500mb',
            name: '500Mb Network Card',
            speed: 500,
            price: 200,
            power: 6,
          },
        }));
      });

      const indicator = document.querySelector('.topbar-bandwidth');
      fireEvent.mouseEnter(indicator);

      await waitFor(() => {
        expect(screen.getByText(/Total: 62.5 MB\/s/)).toBeInTheDocument();
      });
    });

    it('should show "Total: 125.0 MB/s" for 1Gb adapter', async () => {
      let setHardware;
      renderWithProvider((game) => {
        setHardware = game.setHardware;
      });

      act(() => {
        setHardware(prev => ({
          ...prev,
          network: {
            id: 'net-1gb',
            name: '1Gb Network Card',
            speed: 1000,
            price: 500,
            power: 8,
          },
        }));
      });

      const indicator = document.querySelector('.topbar-bandwidth');
      fireEvent.mouseEnter(indicator);

      await waitFor(() => {
        expect(screen.getByText(/Total: 125.0 MB\/s/)).toBeInTheDocument();
      });
    });

    it('should show "Total: 625.0 MB/s" for 5Gb adapter', async () => {
      let setHardware;
      renderWithProvider((game) => {
        setHardware = game.setHardware;
      });

      act(() => {
        setHardware(prev => ({
          ...prev,
          network: {
            id: 'net-5gb',
            name: '5Gb Network Card',
            speed: 5000,
            price: 2000,
            power: 12,
          },
        }));
      });

      const indicator = document.querySelector('.topbar-bandwidth');
      fireEvent.mouseEnter(indicator);

      await waitFor(() => {
        expect(screen.getByText(/Total: 625.0 MB\/s/)).toBeInTheDocument();
      });
    });

    it('should show "Total: 1250.0 MB/s" for 10Gb adapter', async () => {
      let setHardware;
      renderWithProvider((game) => {
        setHardware = game.setHardware;
      });

      act(() => {
        setHardware(prev => ({
          ...prev,
          network: {
            id: 'net-10gb',
            name: '10Gb Network Card',
            speed: 10000,
            price: 5000,
            power: 15,
          },
        }));
      });

      const indicator = document.querySelector('.topbar-bandwidth');
      fireEvent.mouseEnter(indicator);

      await waitFor(() => {
        expect(screen.getByText(/Total: 1250.0 MB\/s/)).toBeInTheDocument();
      });
    });

    it('should return correct adapterSpeed value from getBandwidthInfo()', () => {
      let getBandwidthInfo, setHardware;
      renderWithProvider((game) => {
        getBandwidthInfo = game.getBandwidthInfo;
        setHardware = game.setHardware;
      });

      // Default adapter
      expect(getBandwidthInfo().adapterSpeed).toBe(250);

      // Upgrade to 500Mb
      act(() => {
        setHardware(prev => ({
          ...prev,
          network: { speed: 500 },
        }));
      });

      expect(getBandwidthInfo().adapterSpeed).toBe(500);
    });

    it('should default adapterSpeed to 250 when no adapter defined', () => {
      let getBandwidthInfo, setHardware;
      renderWithProvider((game) => {
        getBandwidthInfo = game.getBandwidthInfo;
        setHardware = game.setHardware;
      });

      act(() => {
        setHardware(prev => ({
          ...prev,
          network: null,
        }));
      });

      expect(getBandwidthInfo().adapterSpeed).toBe(250);
    });

    it('should show Total, In Use, and Available in preview', async () => {
      renderWithProvider();

      const indicator = document.querySelector('.topbar-bandwidth');
      fireEvent.mouseEnter(indicator);

      await waitFor(() => {
        expect(screen.getByText(/Total: 31.3 MB\/s/)).toBeInTheDocument();
        expect(screen.getByText(/In Use:/)).toBeInTheDocument();
        expect(screen.getByText(/Available:/)).toBeInTheDocument();
      });
    });

    it('should update adapter speed immediately after hardware change', async () => {
      let setHardware;
      renderWithProvider((game) => {
        setHardware = game.setHardware;
      });

      const indicator = document.querySelector('.topbar-bandwidth');
      fireEvent.mouseEnter(indicator);

      // Initial state
      await waitFor(() => {
        expect(screen.getByText(/Total: 31.3 MB\/s/)).toBeInTheDocument();
      });

      // Upgrade adapter
      act(() => {
        setHardware(prev => ({
          ...prev,
          network: { speed: 1000 },
        }));
      });

      // Should update immediately
      await waitFor(() => {
        expect(screen.getByText(/Total: 125.0 MB\/s/)).toBeInTheDocument();
      });
    });
  });

  describe('Active Operations Display', () => {
    it('should show idle icon when no operations', () => {
      renderWithProvider();

      const bandwidthIndicator = document.querySelector('.topbar-bandwidth');
      expect(bandwidthIndicator.textContent).toContain('○');
    });

    it('should show active icon when download in progress', async () => {
      let setDownloadQueue;
      renderWithProvider((game) => {
        setDownloadQueue = game.setDownloadQueue;
      });

      act(() => {
        setDownloadQueue([{
          id: 'test-download-1',
          softwareId: 'test-software',
          status: 'downloading',
          progress: 50,
          sizeInMB: 25,
        }]);
      });

      const bandwidthIndicator = document.querySelector('.topbar-bandwidth');
      expect(bandwidthIndicator.textContent).toContain('⬇');
    });

    it('should show active icon when bandwidth operation registered', async () => {
      let registerBandwidthOperation;
      renderWithProvider((game) => {
        registerBandwidthOperation = game.registerBandwidthOperation;
      });

      act(() => {
        registerBandwidthOperation('file_copy', 10, {});
      });

      const bandwidthIndicator = document.querySelector('.topbar-bandwidth');
      expect(bandwidthIndicator.textContent).toContain('⬇');
    });

    it('should show transfer speed next to icon when active', async () => {
      let setDownloadQueue;
      renderWithProvider((game) => {
        setDownloadQueue = game.setDownloadQueue;
      });

      act(() => {
        setDownloadQueue([{
          id: 'test-download-1',
          status: 'downloading',
          sizeInMB: 25,
        }]);
      });

      // Speed should be shown (31.3 MB/s for single op with 250Mbps adapter)
      const speedElement = document.querySelector('.bandwidth-speed');
      expect(speedElement).toBeInTheDocument();
      expect(speedElement.textContent).toBe('31.3');
    });

    it('should update speed when more operations added (bandwidth sharing)', async () => {
      let setDownloadQueue;
      renderWithProvider((game) => {
        setDownloadQueue = game.setDownloadQueue;
      });

      // Single operation
      act(() => {
        setDownloadQueue([{
          id: 'test-1',
          status: 'downloading',
          sizeInMB: 25,
        }]);
      });

      let speedElement = document.querySelector('.bandwidth-speed');
      expect(speedElement.textContent).toBe('31.3'); // Full bandwidth

      // Two operations - bandwidth shared
      act(() => {
        setDownloadQueue([
          { id: 'test-1', status: 'downloading', sizeInMB: 25 },
          { id: 'test-2', status: 'downloading', sizeInMB: 25 },
        ]);
      });

      speedElement = document.querySelector('.bandwidth-speed');
      expect(speedElement.textContent).toBe('15.6'); // Half bandwidth
    });

    it('should revert to idle when operations complete', async () => {
      let setDownloadQueue;
      renderWithProvider((game) => {
        setDownloadQueue = game.setDownloadQueue;
      });

      // Start with active download
      act(() => {
        setDownloadQueue([{
          id: 'test-1',
          status: 'downloading',
          sizeInMB: 25,
        }]);
      });

      expect(document.querySelector('.topbar-bandwidth').textContent).toContain('⬇');

      // Complete download
      act(() => {
        setDownloadQueue([{
          id: 'test-1',
          status: 'complete',
          sizeInMB: 25,
        }]);
      });

      expect(document.querySelector('.topbar-bandwidth').textContent).toContain('○');
    });

    it('should show active operations count in preview', async () => {
      let setDownloadQueue;
      renderWithProvider((game) => {
        setDownloadQueue = game.setDownloadQueue;
      });

      act(() => {
        setDownloadQueue([
          { id: 'test-1', status: 'downloading', sizeInMB: 25 },
          { id: 'test-2', status: 'downloading', sizeInMB: 25 },
          { id: 'test-3', status: 'downloading', sizeInMB: 25 },
        ]);
      });

      const indicator = document.querySelector('.topbar-bandwidth');
      fireEvent.mouseEnter(indicator);

      await waitFor(() => {
        expect(screen.getByText(/Active Operations: 3/)).toBeInTheDocument();
      });
    });
  });

  describe('Adapter Limitation Warning', () => {
    it('should not show warning when not connected to any network', async () => {
      renderWithProvider();

      const indicator = document.querySelector('.topbar-bandwidth');
      fireEvent.mouseEnter(indicator);

      await waitFor(() => {
        expect(screen.getByText(/Bandwidth/)).toBeInTheDocument();
      });

      // Warning should not be present
      expect(screen.queryByText(/Limited by network adapter/)).not.toBeInTheDocument();
    });

    it('should not show warning when network slower than adapter', async () => {
      let setActiveConnections;
      renderWithProvider((game) => {
        setActiveConnections = game.setActiveConnections;
      });

      // Register a slow network (50 Mbps < 250 Mbps adapter)
      networkRegistry.registerNetwork({
        networkId: 'slow-net',
        networkName: 'Slow Network',
        bandwidth: 50,
      });

      act(() => {
        setActiveConnections([{ networkId: 'slow-net' }]);
      });

      const indicator = document.querySelector('.topbar-bandwidth');
      fireEvent.mouseEnter(indicator);

      await waitFor(() => {
        expect(screen.getByText(/Bandwidth/)).toBeInTheDocument();
      });

      // Network is the bottleneck, not adapter - no warning
      expect(screen.queryByText(/Limited by network adapter/)).not.toBeInTheDocument();
    });

    it('should show warning when adapter slower than network', async () => {
      let setActiveConnections;
      renderWithProvider((game) => {
        setActiveConnections = game.setActiveConnections;
      });

      // Register a fast network (500 Mbps > 250 Mbps adapter)
      networkRegistry.registerNetwork({
        networkId: 'fast-net',
        networkName: 'Fast Network',
        bandwidth: 500,
      });

      act(() => {
        setActiveConnections([{ networkId: 'fast-net' }]);
      });

      const indicator = document.querySelector('.topbar-bandwidth');
      fireEvent.mouseEnter(indicator);

      await waitFor(() => {
        expect(screen.getByText(/Limited by network adapter/)).toBeInTheDocument();
      });
    });

    it('should show warning with multiple high-bandwidth networks', async () => {
      let setActiveConnections;
      renderWithProvider((game) => {
        setActiveConnections = game.setActiveConnections;
      });

      // Register multiple fast networks
      networkRegistry.registerNetwork({
        networkId: 'fast-net-1',
        networkName: 'Fast Network 1',
        bandwidth: 500,
      });
      networkRegistry.registerNetwork({
        networkId: 'fast-net-2',
        networkName: 'Fast Network 2',
        bandwidth: 1000,
      });

      act(() => {
        setActiveConnections([
          { networkId: 'fast-net-1' },
          { networkId: 'fast-net-2' },
        ]);
      });

      const indicator = document.querySelector('.topbar-bandwidth');
      fireEvent.mouseEnter(indicator);

      await waitFor(() => {
        expect(screen.getByText(/Limited by network adapter/)).toBeInTheDocument();
      });
    });

    it('should hide warning after upgrading adapter', async () => {
      let setActiveConnections, setHardware;
      renderWithProvider((game) => {
        setActiveConnections = game.setActiveConnections;
        setHardware = game.setHardware;
      });

      // Register a fast network (500 Mbps > 250 Mbps adapter)
      networkRegistry.registerNetwork({
        networkId: 'fast-net',
        networkName: 'Fast Network',
        bandwidth: 500,
      });

      act(() => {
        setActiveConnections([{ networkId: 'fast-net' }]);
      });

      const indicator = document.querySelector('.topbar-bandwidth');
      fireEvent.mouseEnter(indicator);

      // Warning should show initially
      await waitFor(() => {
        expect(screen.getByText(/Limited by network adapter/)).toBeInTheDocument();
      });

      // Upgrade to 1Gb adapter
      act(() => {
        setHardware(prev => ({
          ...prev,
          network: { speed: 1000 },
        }));
      });

      // Warning should disappear
      await waitFor(() => {
        expect(screen.queryByText(/Limited by network adapter/)).not.toBeInTheDocument();
      });
    });
  });

  describe('Bandwidth Sharing Calculations', () => {
    it('should show full bandwidth for single operation (31.3 MB/s)', async () => {
      let getBandwidthInfo, setDownloadQueue;
      renderWithProvider((game) => {
        getBandwidthInfo = game.getBandwidthInfo;
        setDownloadQueue = game.setDownloadQueue;
      });

      act(() => {
        setDownloadQueue([{
          id: 'test-1',
          status: 'downloading',
          sizeInMB: 25,
        }]);
      });

      const info = getBandwidthInfo();
      expect(info.transferSpeedMBps).toBeCloseTo(31.25, 1);
    });

    it('should show halved bandwidth for two operations (15.6 MB/s)', async () => {
      let getBandwidthInfo, setDownloadQueue;
      renderWithProvider((game) => {
        getBandwidthInfo = game.getBandwidthInfo;
        setDownloadQueue = game.setDownloadQueue;
      });

      act(() => {
        setDownloadQueue([
          { id: 'test-1', status: 'downloading', sizeInMB: 25 },
          { id: 'test-2', status: 'downloading', sizeInMB: 25 },
        ]);
      });

      const info = getBandwidthInfo();
      expect(info.transferSpeedMBps).toBeCloseTo(15.625, 1);
    });

    it('should show quartered bandwidth for four operations (7.8 MB/s)', async () => {
      let getBandwidthInfo, setDownloadQueue;
      renderWithProvider((game) => {
        getBandwidthInfo = game.getBandwidthInfo;
        setDownloadQueue = game.setDownloadQueue;
      });

      act(() => {
        setDownloadQueue([
          { id: 'test-1', status: 'downloading', sizeInMB: 25 },
          { id: 'test-2', status: 'downloading', sizeInMB: 25 },
          { id: 'test-3', status: 'downloading', sizeInMB: 25 },
          { id: 'test-4', status: 'downloading', sizeInMB: 25 },
        ]);
      });

      const info = getBandwidthInfo();
      expect(info.transferSpeedMBps).toBeCloseTo(7.8125, 1);
    });

    it('should update bandwidth share when operation completes', async () => {
      let getBandwidthInfo, setDownloadQueue;
      renderWithProvider((game) => {
        getBandwidthInfo = game.getBandwidthInfo;
        setDownloadQueue = game.setDownloadQueue;
      });

      // Start with two operations
      act(() => {
        setDownloadQueue([
          { id: 'test-1', status: 'downloading', sizeInMB: 25 },
          { id: 'test-2', status: 'downloading', sizeInMB: 25 },
        ]);
      });

      expect(getBandwidthInfo().transferSpeedMBps).toBeCloseTo(15.625, 1);

      // Complete one operation
      act(() => {
        setDownloadQueue([
          { id: 'test-1', status: 'complete', sizeInMB: 25 },
          { id: 'test-2', status: 'downloading', sizeInMB: 25 },
        ]);
      });

      // Should return to full bandwidth
      expect(getBandwidthInfo().transferSpeedMBps).toBeCloseTo(31.25, 1);
    });

    it('should cap usage bar at 100% with 4+ operations', async () => {
      let getBandwidthInfo, setDownloadQueue;
      renderWithProvider((game) => {
        getBandwidthInfo = game.getBandwidthInfo;
        setDownloadQueue = game.setDownloadQueue;
      });

      // 4 operations = 100%
      act(() => {
        setDownloadQueue([
          { id: 'test-1', status: 'downloading', sizeInMB: 25 },
          { id: 'test-2', status: 'downloading', sizeInMB: 25 },
          { id: 'test-3', status: 'downloading', sizeInMB: 25 },
          { id: 'test-4', status: 'downloading', sizeInMB: 25 },
        ]);
      });

      expect(getBandwidthInfo().usagePercent).toBe(100);

      // 5 operations = still capped at 100%
      act(() => {
        setDownloadQueue([
          { id: 'test-1', status: 'downloading', sizeInMB: 25 },
          { id: 'test-2', status: 'downloading', sizeInMB: 25 },
          { id: 'test-3', status: 'downloading', sizeInMB: 25 },
          { id: 'test-4', status: 'downloading', sizeInMB: 25 },
          { id: 'test-5', status: 'downloading', sizeInMB: 25 },
        ]);
      });

      expect(getBandwidthInfo().usagePercent).toBe(100);
    });
  });

  it('should update bandwidth info popup when network adapter is upgraded', async () => {
    let setHardware;
    renderWithProvider((game) => {
      setHardware = game.setHardware;
    });

    // Hover to show bandwidth preview (initial: 250Mbps)
    const indicator = document.querySelector('.topbar-bandwidth');
    fireEvent.mouseEnter(indicator);
    await waitFor(() => {
      expect(screen.getByText(/Total: 31.3 MB\/s/)).toBeInTheDocument();
    });

    // Upgrade to 500Mbps
    setHardware(prev => ({
      ...prev,
      network: {
        id: 'net-500mb',
        name: '500Mb Network Card',
        speed: 500,
        price: 200,
        power: 6,
      },
    }));
    // Hover again to update
    fireEvent.mouseEnter(indicator);
    await waitFor(() => {
      expect(screen.getByText(/Total: 62.5 MB\/s/)).toBeInTheDocument();
    });
  });
});
