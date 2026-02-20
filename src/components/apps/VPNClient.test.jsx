import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithGame } from '../../test/helpers/renderHelpers';
import VPNClient from './VPNClient';

describe('VPNClient Component', () => {
  it('should render app title', () => {
    renderWithGame(<VPNClient />);
    expect(screen.getByText('SourceNet VPN Client')).toBeInTheDocument();
  });

  it('should show empty state when no connections', () => {
    renderWithGame(<VPNClient />);
    expect(screen.getByText('No active connections')).toBeInTheDocument();
  });

  it('should show network selection dropdown', () => {
    renderWithGame(<VPNClient />);
    expect(screen.getByText('New Connection')).toBeInTheDocument();
  });

  it('should show message when no network credentials available', () => {
    renderWithGame(<VPNClient />);
    expect(screen.getByText(/No network credentials available/i)).toBeInTheDocument();
  });
});
