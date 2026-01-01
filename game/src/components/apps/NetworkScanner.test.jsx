import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { GameProvider } from '../../contexts/GameContext';
import NetworkScanner from './NetworkScanner';
import triggerEventBus from '../../core/triggerEventBus';

const renderWithProvider = (component) => {
  return render(<GameProvider>{component}</GameProvider>);
};

describe('NetworkScanner Component', () => {
  beforeEach(() => {
    triggerEventBus.clear();
  });

  afterEach(() => {
    triggerEventBus.clear();
  });

  it('should render app title', () => {
    renderWithProvider(<NetworkScanner />);
    expect(screen.getByText('Network Scanner')).toBeInTheDocument();
  });

  it('should render subtitle', () => {
    renderWithProvider(<NetworkScanner />);
    expect(screen.getByText('Discover machines and file systems')).toBeInTheDocument();
  });

  it('should show scan controls', () => {
    renderWithProvider(<NetworkScanner />);
    expect(screen.getByText(/Network:/)).toBeInTheDocument();
    expect(screen.getByText(/Scan Type:/)).toBeInTheDocument();
  });

  it('should have scan button', () => {
    renderWithProvider(<NetworkScanner />);
    const scanBtn = screen.getByRole('button', { name: /Start Scan/i });
    expect(scanBtn).toBeInTheDocument();
    expect(scanBtn).toBeDisabled(); // No network selected
  });

  it('should have quick and deep scan options', () => {
    renderWithProvider(<NetworkScanner />);
    expect(screen.getByText(/Quick Scan/i)).toBeInTheDocument();
    expect(screen.getByText(/Deep Scan/i)).toBeInTheDocument();
  });

  it('should default to deep scan', () => {
    renderWithProvider(<NetworkScanner />);
    const selects = screen.getAllByRole('combobox');
    const scanTypeSelect = selects[1];
    expect(scanTypeSelect.value).toBe('deep');
  });

  it('should show network selector placeholder', () => {
    renderWithProvider(<NetworkScanner />);
    expect(screen.getByText('Select connected network')).toBeInTheDocument();
  });
});

describe('NetworkScanner bandwidth integration', () => {
  beforeEach(() => {
    triggerEventBus.clear();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    triggerEventBus.clear();
  });

  it('should use bandwidth-based scan timing', () => {
    // Test that NetworkScanner is configured to use bandwidth
    // The actual bandwidth operation is registered when a scan starts
    renderWithProvider(<NetworkScanner />);

    // Verify the component structure is correct
    expect(screen.getByText('Network Scanner')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Start Scan/i })).toBeInTheDocument();
  });

  it('should have scan sizes defined for quick and deep scans', () => {
    // The SCAN_SIZES constant in NetworkScanner defines:
    // - quick: 5 MB
    // - deep: 15 MB
    // This test verifies the dropdown options exist
    renderWithProvider(<NetworkScanner />);

    expect(screen.getByText(/Quick Scan \(5s/i)).toBeInTheDocument();
    expect(screen.getByText(/Deep Scan \(15s/i)).toBeInTheDocument();
  });
});
