import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { GameProvider } from '../../contexts/GameContext';
import FileManager from './FileManager';

const renderWithProvider = (component) => {
  return render(<GameProvider>{component}</GameProvider>);
};

describe('FileManager Component', () => {
  it('should render app title', () => {
    renderWithProvider(<FileManager />);
    expect(screen.getByText('File Manager')).toBeInTheDocument();
  });

  it('should show not connected message when no network connection', () => {
    renderWithProvider(<FileManager />);
    expect(screen.getByText(/Not connected to any networks/i)).toBeInTheDocument();
  });
});
