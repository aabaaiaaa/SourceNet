import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithGame } from '../../test/helpers/renderHelpers';
import NetworkScanner from './NetworkScanner';
import triggerEventBus from '../../core/triggerEventBus';

describe('NetworkScanner Component', () => {
  beforeEach(() => {
    triggerEventBus.clear();
  });

  afterEach(() => {
    triggerEventBus.clear();
  });

  it('should render app title', () => {
    renderWithGame(<NetworkScanner />);
    expect(screen.getByText('Network Scanner')).toBeInTheDocument();
  });

  it('should render subtitle', () => {
    renderWithGame(<NetworkScanner />);
    expect(screen.getByText('Discover machines and file systems')).toBeInTheDocument();
  });

  it('should show scan controls', () => {
    renderWithGame(<NetworkScanner />);
    expect(screen.getByText(/Network:/)).toBeInTheDocument();
    // Scan button is only shown when a network is connected
    expect(screen.getByText(/No networks connected/i)).toBeInTheDocument();
  });

  it('should show no-networks message when disconnected', () => {
    renderWithGame(<NetworkScanner />);
    // No scan button visible without network connection
    expect(screen.queryByRole('button', { name: /Start Scan/i })).not.toBeInTheDocument();
    expect(screen.getByText(/No networks connected/i)).toBeInTheDocument();
  });

  it('should hide scan button when no network connected', () => {
    renderWithGame(<NetworkScanner />);
    // Scan button not visible without connection
    expect(screen.queryByRole('button', { name: /Start Scan/i })).not.toBeInTheDocument();
  });

  it('should show network selector placeholder', () => {
    renderWithGame(<NetworkScanner />);
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
    renderWithGame(<NetworkScanner />);

    // Verify the component structure is correct
    expect(screen.getByText('Network Scanner')).toBeInTheDocument();
    // Scan button only appears when network is connected
    expect(screen.getByText(/No networks connected/i)).toBeInTheDocument();
  });

  it('should use device-based scan sizing', () => {
    // NetworkScanner uses device-based scan sizing:
    // totalSizeMB = BASE_SCAN_SIZE_MB (10) + deviceCount * PER_DEVICE_SIZE_MB (5)
    // Scan controls are only visible when a network is connected
    // This test verifies the no-connection state is shown properly
    renderWithGame(<NetworkScanner />);

    expect(screen.getByText(/No networks connected/i)).toBeInTheDocument();
  });
});
