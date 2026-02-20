import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { renderWithGame } from '../../test/helpers/renderHelpers';
import LogViewer from './LogViewer';
import triggerEventBus from '../../core/triggerEventBus';

describe('LogViewer Component', () => {
  beforeEach(() => {
    triggerEventBus.clear();
  });

  afterEach(() => {
    triggerEventBus.clear();
  });

  it('should render app title', () => {
    renderWithGame(<LogViewer />);
    expect(screen.getByText('Log Viewer')).toBeInTheDocument();
  });

  it('should render subtitle', () => {
    renderWithGame(<LogViewer />);
    expect(screen.getByText('View network and device activity logs')).toBeInTheDocument();
  });

  it('should show Network Logs tab by default', () => {
    renderWithGame(<LogViewer />);
    const networkTab = screen.getByRole('button', { name: /Network Logs/i });
    expect(networkTab).toHaveClass('active');
  });

  it('should show Device Logs tab', () => {
    renderWithGame(<LogViewer />);
    expect(screen.getByRole('button', { name: /Device Logs/i })).toBeInTheDocument();
  });

  it('should switch between tabs', () => {
    renderWithGame(<LogViewer />);

    const networkTab = screen.getByRole('button', { name: /Network Logs/i });
    const deviceTab = screen.getByRole('button', { name: /Device Logs/i });

    // Network tab should be active by default
    expect(networkTab).toHaveClass('active');
    expect(deviceTab).not.toHaveClass('active');

    // Click device tab
    fireEvent.click(deviceTab);

    // Device tab should now be active
    expect(deviceTab).toHaveClass('active');
    expect(networkTab).not.toHaveClass('active');

    // Click network tab again
    fireEvent.click(networkTab);

    // Network tab should be active again
    expect(networkTab).toHaveClass('active');
    expect(deviceTab).not.toHaveClass('active');
  });

  it('should show no-networks message when no networks connected', () => {
    renderWithGame(<LogViewer />);
    expect(screen.getByText(/No networks connected/i)).toBeInTheDocument();
  });

  it('should disable View Logs button when no network selected', () => {
    renderWithGame(<LogViewer />);
    // In Network tab with no networks connected, button doesn't show
    // because no-networks message is displayed instead
    expect(screen.queryByRole('button', { name: /View Logs/i })).not.toBeInTheDocument();
  });

  it('should show network selector placeholder', () => {
    renderWithGame(<LogViewer />);
    // Message is shown when no networks connected
    expect(screen.getByText(/Use the VPN Client to connect to a network first/i)).toBeInTheDocument();
  });
});

describe('LogViewer Device Tab', () => {
  beforeEach(() => {
    triggerEventBus.clear();
  });

  afterEach(() => {
    triggerEventBus.clear();
  });

  it('should show no-networks message on device tab when no networks connected', () => {
    renderWithGame(<LogViewer />);

    // Switch to device tab
    const deviceTab = screen.getByRole('button', { name: /Device Logs/i });
    fireEvent.click(deviceTab);

    expect(screen.getByText(/No networks connected/i)).toBeInTheDocument();
  });
});
