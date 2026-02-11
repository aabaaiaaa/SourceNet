import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { GameProvider } from '../../contexts/GameContext';
import TopBar from './TopBar';

// Mock helpers module with all required exports
vi.mock('../../utils/helpers', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    formatDateTime: () => '25/03/2020 09:00:00',
  };
});

const renderWithProvider = (component) => {
  return render(<GameProvider>{component}</GameProvider>);
};

describe('TopBar Component', () => {
  it('should render power button', () => {
    renderWithProvider(<TopBar />);
    expect(screen.getByText('⏻')).toBeInTheDocument();
  });

  it('should display formatted time', () => {
    renderWithProvider(<TopBar />);
    expect(screen.getByText('25/03/2020 09:00:00')).toBeInTheDocument();
  });

  it('should display time speed toggle', () => {
    renderWithProvider(<TopBar />);
    expect(screen.getByText('1x')).toBeInTheDocument();
  });

  it('should display credits', () => {
    renderWithProvider(<TopBar />);
    expect(screen.getByText(/0 credits/)).toBeInTheDocument();
  });

  it('should display notification icons', () => {
    renderWithProvider(<TopBar />);
    expect(screen.getByText('✉')).toBeInTheDocument();
    expect(screen.getByText('💳')).toBeInTheDocument();
  });

  it('should display app launcher button', () => {
    renderWithProvider(<TopBar />);
    expect(screen.getByText('☰')).toBeInTheDocument();
  });

  it('should show power menu on hover', async () => {
    renderWithProvider(<TopBar />);
    const powerButton = screen.getByText('⏻');

    fireEvent.mouseEnter(powerButton.parentElement);

    await waitFor(() => {
      expect(screen.getByText('Pause')).toBeInTheDocument();
      expect(screen.getByText('Save')).toBeInTheDocument();
      expect(screen.getByText('Load')).toBeInTheDocument();
      expect(screen.getByText('Reboot')).toBeInTheDocument();
      expect(screen.getByText('Sleep')).toBeInTheDocument();
    });
  });

  it('should show app launcher menu on hover', async () => {
    renderWithProvider(<TopBar />);
    const appLauncherButton = screen.getByText('☰');

    fireEvent.mouseEnter(appLauncherButton.parentElement);

    await waitFor(() => {
      expect(screen.getByText('OSNet Portal')).toBeInTheDocument();
      expect(screen.getByText('SNet Banking App')).toBeInTheDocument();
      expect(screen.getByText('SNet Mail')).toBeInTheDocument();
    });
  });

  it('should toggle time speed when clicked', () => {
    renderWithProvider(<TopBar />);
    const speedToggle = screen.getByText('1x');

    fireEvent.click(speedToggle);

    expect(screen.getByText('10x')).toBeInTheDocument();
  });

  it('should toggle pause/resume when pause button clicked', async () => {
    renderWithProvider(<TopBar />);
    const powerButton = screen.getByText('⏻');

    fireEvent.mouseEnter(powerButton.parentElement);

    await waitFor(() => {
      expect(screen.getByText('Pause')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Pause'));

    // Menu should close and show Resume next time
    fireEvent.mouseEnter(powerButton.parentElement);
    await waitFor(() => {
      expect(screen.getByText('Resume')).toBeInTheDocument();
    });
  });

  it('should show save dialog when Save clicked', async () => {
    // Mock window.prompt
    global.prompt = vi.fn(() => 'TestSave');
    global.alert = vi.fn();

    renderWithProvider(<TopBar />);
    const powerButton = screen.getByText('⏻');

    fireEvent.mouseEnter(powerButton.parentElement);

    await waitFor(() => {
      expect(screen.getByText('Save')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Save'));

    expect(global.prompt).toHaveBeenCalled();
    expect(global.alert).toHaveBeenCalledWith('Game saved!');
  });

  it('should show load modal when Load clicked', async () => {
    renderWithProvider(<TopBar />);
    const powerButton = screen.getByText('⏻');

    fireEvent.mouseEnter(powerButton.parentElement);

    await waitFor(() => {
      expect(screen.getByText('Load')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Load'));

    // Load modal should appear
    await waitFor(() => {
      expect(screen.getByText('Load Game')).toBeInTheDocument();
    });

    // Should show "No saved games" message when no saves exist
    expect(screen.getByText('No saved games found.')).toBeInTheDocument();
  });

  it('should show confirmation when Reboot clicked', async () => {
    global.confirm = vi.fn(() => false); // User cancels

    renderWithProvider(<TopBar />);
    const powerButton = screen.getByText('⏻');

    fireEvent.mouseEnter(powerButton.parentElement);

    await waitFor(() => {
      expect(screen.getByText('Reboot')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Reboot'));

    expect(global.confirm).toHaveBeenCalledWith(
      'Reboot the system? This will close all opened apps.'
    );
  });

  it('should show Sleep option in power menu', async () => {
    renderWithProvider(<TopBar />);
    const powerButton = screen.getByText('⏻');

    fireEvent.mouseEnter(powerButton.parentElement);

    await waitFor(() => {
      expect(screen.getByText('Sleep')).toBeInTheDocument();
    });

    // Sleep functionality tested in E2E tests
  });

  describe('bandwidth indicator', () => {
    it('should display bandwidth indicator', () => {
      renderWithProvider(<TopBar />);

      // Bandwidth indicator should be present (idle state shows circle)
      const bandwidthIndicator = document.querySelector('.topbar-bandwidth');
      expect(bandwidthIndicator).toBeInTheDocument();
    });

    it('should show idle icon when no active operations', () => {
      renderWithProvider(<TopBar />);

      const bandwidthIndicator = document.querySelector('.topbar-bandwidth');
      expect(bandwidthIndicator).toBeInTheDocument();
      expect(bandwidthIndicator.textContent).toContain('○');
    });

    it('should have bandwidth class on indicator', () => {
      renderWithProvider(<TopBar />);

      const bandwidthIndicator = document.querySelector('.topbar-bandwidth');
      expect(bandwidthIndicator).toBeInTheDocument();
      expect(bandwidthIndicator).toHaveClass('topbar-bandwidth');
    });

    it('should have bandwidth icon element', () => {
      renderWithProvider(<TopBar />);

      const bandwidthIcon = document.querySelector('.bandwidth-icon');
      expect(bandwidthIcon).toBeInTheDocument();
    });

    it('should not show speed element when inactive', () => {
      renderWithProvider(<TopBar />);

      const speedElement = document.querySelector('.bandwidth-speed');
      expect(speedElement).not.toBeInTheDocument();
    });

    it('should show preview with Total, In Use, Available, Active Operations on hover', async () => {
      renderWithProvider(<TopBar />);

      const bandwidthIndicator = document.querySelector('.topbar-bandwidth');
      fireEvent.mouseEnter(bandwidthIndicator);

      await waitFor(() => {
        // Preview header
        expect(screen.getByText('Bandwidth')).toBeInTheDocument();
        // All preview items
        expect(screen.getByText(/Total:/)).toBeInTheDocument();
        expect(screen.getByText(/In Use:/)).toBeInTheDocument();
        expect(screen.getByText(/Available:/)).toBeInTheDocument();
        expect(screen.getByText(/Active Operations:/)).toBeInTheDocument();
      });
    });

    it('should show total bandwidth in MB/s format', async () => {
      renderWithProvider(<TopBar />);

      const bandwidthIndicator = document.querySelector('.topbar-bandwidth');
      fireEvent.mouseEnter(bandwidthIndicator);

      await waitFor(() => {
        expect(screen.getByText(/Total: 31.3 MB\/s/)).toBeInTheDocument();
      });
    });

    it('should not show usage bar when idle', () => {
      renderWithProvider(<TopBar />);

      const usageBar = document.querySelector('.bandwidth-usage-bar');
      expect(usageBar).not.toBeInTheDocument();
    });
  });
});
