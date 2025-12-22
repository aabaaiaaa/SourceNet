import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { GameProvider } from '../../contexts/GameContext';
import TopBar from './TopBar';

// Mock helpers module with all required exports
vi.mock('../../utils/helpers', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    formatDateTime: (date) => '25/03/2020 09:00:00',
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
});
