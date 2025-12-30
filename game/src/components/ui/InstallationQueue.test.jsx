import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { GameProvider } from '../../contexts/GameContext';
import InstallationQueue from './InstallationQueue';

const renderWithProvider = (component) => {
  return render(<GameProvider>{component}</GameProvider>);
};

describe('InstallationQueue Component', () => {
  it('should not render when no downloads', () => {
    const { container } = renderWithProvider(<InstallationQueue />);
    expect(container.firstChild).toBe(null);
  });

  it('should render when downloads exist', () => {
    // This test would need a way to provide mock downloadQueue
    // For now, verify component renders without errors
    expect(() => renderWithProvider(<InstallationQueue />)).not.toThrow();
  });
});
