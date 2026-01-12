import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { GameProvider } from '../../contexts/GameContext';
import MissionBoard from './MissionBoard';

const renderWithProvider = (component) => {
  return render(<GameProvider>{component}</GameProvider>);
};

describe('MissionBoard Component', () => {
  it('should render app title', () => {
    renderWithProvider(<MissionBoard />);
    expect(screen.getByText('SourceNet Mission Board')).toBeInTheDocument();
  });

  it('should have three tabs', () => {
    renderWithProvider(<MissionBoard />);
    expect(screen.getByText('Available Missions')).toBeInTheDocument();
    expect(screen.getByText('Active Mission')).toBeInTheDocument();
    expect(screen.getByText('Completed')).toBeInTheDocument();
  });

  it('should show empty state when no missions', () => {
    renderWithProvider(<MissionBoard />);
    expect(screen.getByText(/No missions currently available/i)).toBeInTheDocument();
  });

  it('should show subtitle', () => {
    renderWithProvider(<MissionBoard />);
    expect(screen.getByText('Ethical Hacking Contracts')).toBeInTheDocument();
  });
});
