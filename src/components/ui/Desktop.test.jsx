import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithGame } from '../../test/helpers/renderHelpers';
import Desktop from './Desktop';

describe('Desktop Component', () => {
  it('should render desktop', () => {
    renderWithGame(<Desktop />);
    expect(screen.getByRole('button', { name: /⏻/ })).toBeInTheDocument();
  });

  it('should render TopBar', () => {
    renderWithGame(<Desktop />);
    // TopBar elements should be visible
    expect(screen.getByText(/credits/i)).toBeInTheDocument();
  });

  it('should render MinimizedWindowBar area', () => {
    renderWithGame(<Desktop />);
    // Component should render without errors
    const desktop = document.querySelector('.desktop');
    expect(desktop).toBeInTheDocument();
  });
});
