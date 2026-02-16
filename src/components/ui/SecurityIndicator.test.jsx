import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import SecurityIndicator from './SecurityIndicator';

describe('SecurityIndicator', () => {
  it('renders shield icon with no alerts', () => {
    render(<SecurityIndicator processing={false} cleanupProgress={0} threatCount={0} />);
    expect(screen.getByTitle('Protected')).toBeTruthy();
  });

  it('does not show popup when no alerts and not hovered', () => {
    render(<SecurityIndicator processing={false} cleanupProgress={0} threatCount={0} avAlerts={[]} />);
    expect(screen.queryByText('Advanced Firewall & Antivirus')).toBeNull();
  });

  it('auto-shows popup when avAlerts has entries', () => {
    const alerts = [{ fileName: 'malware.db', phase: 'scanning' }];
    render(<SecurityIndicator processing={true} cleanupProgress={0} threatCount={0} avAlerts={alerts} />);
    expect(screen.getByText('Advanced Firewall & Antivirus')).toBeTruthy();
    expect(screen.getByText('Scan Alerts')).toBeTruthy();
  });

  it('shows scanning text with file name for scanning phase', () => {
    const alerts = [{ fileName: 'evil.exe', phase: 'scanning' }];
    render(<SecurityIndicator processing={true} cleanupProgress={0} threatCount={0} avAlerts={alerts} />);
    expect(screen.getByText('Scanning: evil.exe')).toBeTruthy();
  });

  it('shows removed text with file name for cleared phase', () => {
    const alerts = [{ fileName: 'evil.exe', phase: 'cleared' }];
    render(<SecurityIndicator processing={false} cleanupProgress={0} threatCount={0} avAlerts={alerts} />);
    expect(screen.getByText('Removed: evil.exe')).toBeTruthy();
  });

  it('shows processing state when any alert is scanning', () => {
    const alerts = [{ fileName: 'evil.exe', phase: 'scanning' }];
    const { container } = render(
      <SecurityIndicator processing={true} cleanupProgress={0} threatCount={0} avAlerts={alerts} />
    );
    expect(container.querySelector('.security-spinner')).toBeTruthy();
  });

  it('renders multiple alerts stacked', () => {
    const alerts = [
      { fileName: 'file1.db', phase: 'scanning' },
      { fileName: 'file2.db', phase: 'cleared' },
    ];
    render(<SecurityIndicator processing={true} cleanupProgress={0} threatCount={0} avAlerts={alerts} />);
    expect(screen.getByText('Scanning: file1.db')).toBeTruthy();
    expect(screen.getByText('Removed: file2.db')).toBeTruthy();
  });
});
