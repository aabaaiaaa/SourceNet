import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithGame } from '../../test/helpers/renderHelpers';
import PauseOverlay from './PauseOverlay';

describe('PauseOverlay Component', () => {
  it('should render pause overlay', () => {
    renderWithGame(<PauseOverlay />);
    expect(screen.getByText('PAUSED')).toBeInTheDocument();
  });

  it('should show resume instruction', () => {
    renderWithGame(<PauseOverlay />);
    expect(screen.getByText(/Click anywhere or press ESC/i)).toBeInTheDocument();
  });
});
