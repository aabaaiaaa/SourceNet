import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { GameProvider } from '../../contexts/GameContext';
import UsernameSelection from './UsernameSelection';

const renderWithProvider = (component) => {
  return render(<GameProvider>{component}</GameProvider>);
};

describe('UsernameSelection Component', () => {
  it('should render username selection screen', () => {
    renderWithProvider(<UsernameSelection />);
    expect(screen.getByText(/Welcome to OSNet/i)).toBeInTheDocument();
  });

  it('should have username input', () => {
    renderWithProvider(<UsernameSelection />);
    expect(screen.getByRole('textbox')).toBeInTheDocument();
  });

  it('should have continue button', () => {
    renderWithProvider(<UsernameSelection />);
    expect(screen.getByText('Continue')).toBeInTheDocument();
  });
});
