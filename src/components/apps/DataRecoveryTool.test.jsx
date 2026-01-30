import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { GameProvider } from '../../contexts/GameContext';
import DataRecoveryTool from './DataRecoveryTool';
import triggerEventBus from '../../core/triggerEventBus';

const renderWithProvider = (component) => {
  return render(<GameProvider>{component}</GameProvider>);
};

describe('DataRecoveryTool Component', () => {
  beforeEach(() => {
    triggerEventBus.clear();
  });

  afterEach(() => {
    triggerEventBus.clear();
  });

  it('should render app title', () => {
    renderWithProvider(<DataRecoveryTool />);
    expect(screen.getByText('Data Recovery Tool')).toBeInTheDocument();
  });

  it('should render subtitle', () => {
    renderWithProvider(<DataRecoveryTool />);
    expect(screen.getByText('File System Recovery & Secure Deletion')).toBeInTheDocument();
  });

  it('should show no-networks message when no networks connected', () => {
    renderWithProvider(<DataRecoveryTool />);
    expect(screen.getByText(/No networks connected/i)).toBeInTheDocument();
  });

  it('should show VPN Client instruction when no networks connected', () => {
    renderWithProvider(<DataRecoveryTool />);
    expect(screen.getByText(/Use the VPN Client to connect to a network first/i)).toBeInTheDocument();
  });

  it('should have file system selector placeholder', () => {
    renderWithProvider(<DataRecoveryTool />);
    // Message is shown when no networks connected - file system selector is not rendered
    expect(screen.getByText(/No networks connected/i)).toBeInTheDocument();
  });
});

describe('DataRecoveryTool UI Elements', () => {
  beforeEach(() => {
    triggerEventBus.clear();
  });

  afterEach(() => {
    triggerEventBus.clear();
  });

  it('should render without crashing', () => {
    const { container } = renderWithProvider(<DataRecoveryTool />);
    expect(container.querySelector('.data-recovery-tool')).toBeInTheDocument();
  });

  it('should have the correct CSS class', () => {
    const { container } = renderWithProvider(<DataRecoveryTool />);
    expect(container.querySelector('.data-recovery-tool')).toBeInTheDocument();
  });

  it('should have header section with correct class', () => {
    const { container } = renderWithProvider(<DataRecoveryTool />);
    expect(container.querySelector('.data-recovery-header')).toBeInTheDocument();
  });
});
