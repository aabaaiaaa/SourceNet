import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { GameProvider } from '../../contexts/GameContext';
import SNetMail from './SNetMail';

const renderWithProvider = (component) => {
  return render(<GameProvider>{component}</GameProvider>);
};

describe('SNetMail Component', () => {
  it('should render mail ID', () => {
    renderWithProvider(<SNetMail />);
    expect(screen.getByText(/Your Mail ID:/)).toBeInTheDocument();
  });

  it('should render inbox and archive tabs', () => {
    renderWithProvider(<SNetMail />);
    expect(screen.getByText(/Inbox/)).toBeInTheDocument();
    expect(screen.getByText(/Archive/)).toBeInTheDocument();
  });

  it('should show empty state when no messages', () => {
    renderWithProvider(<SNetMail />);
    expect(screen.getByText(/No messages in inbox/)).toBeInTheDocument();
  });

  it('should switch between inbox and archive tabs', () => {
    renderWithProvider(<SNetMail />);

    const archiveTab = screen.getByText(/Archive/);
    fireEvent.click(archiveTab);

    expect(screen.getByText(/No messages in archive/)).toBeInTheDocument();
  });
});
