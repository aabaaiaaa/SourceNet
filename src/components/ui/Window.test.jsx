import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithGame } from '../../test/helpers/renderHelpers';
import Window from './Window';

// Mock the app components
vi.mock('../apps/SNetMail', () => ({
  default: () => <div>SNet Mail App</div>,
}));

vi.mock('../apps/BankingApp', () => ({
  default: () => <div>Banking App</div>,
}));

vi.mock('../apps/Portal', () => ({
  default: () => <div>Portal App</div>,
}));

const mockWindow = {
  appId: 'mail',
  zIndex: 1000,
  minimized: false,
  position: { x: 100, y: 100 },
};

describe('Window Component', () => {
  it('should render window with correct title', () => {
    renderWithGame(<Window window={mockWindow} />);
    expect(screen.getByText('SNet Mail')).toBeInTheDocument();
  });

  it('should render minimize button', () => {
    renderWithGame(<Window window={mockWindow} />);
    expect(screen.getByTitle('Minimize')).toBeInTheDocument();
  });

  it('should render close button', () => {
    renderWithGame(<Window window={mockWindow} />);
    expect(screen.getByTitle('Close')).toBeInTheDocument();
  });

  it('should render app content', () => {
    renderWithGame(<Window window={mockWindow} />);
    expect(screen.getByText('SNet Mail App')).toBeInTheDocument();
  });

  it('should render banking app when appId is banking', () => {
    const bankingWindow = { ...mockWindow, appId: 'banking' };
    renderWithGame(<Window window={bankingWindow} />);
    expect(screen.getByText('Banking App')).toBeInTheDocument();
    expect(screen.getByText('SNet Banking App')).toBeInTheDocument();
  });

  it('should render portal app when appId is portal', () => {
    const portalWindow = { ...mockWindow, appId: 'portal' };
    renderWithGame(<Window window={portalWindow} />);
    expect(screen.getByText('Portal App')).toBeInTheDocument();
    expect(screen.getByText('OSNet Portal')).toBeInTheDocument();
  });
});
