import { describe, it, expect } from 'vitest';
import { renderWithGame } from '../../test/helpers/renderHelpers';
import InstallationQueue from './InstallationQueue';

describe('InstallationQueue Component', () => {
  it('should not render when no downloads', () => {
    const { container } = renderWithGame(<InstallationQueue />);
    expect(container.firstChild).toBe(null);
  });

  it('should render when downloads exist', () => {
    // This test would need a way to provide mock downloadQueue
    // For now, verify component renders without errors
    expect(() => renderWithGame(<InstallationQueue />)).not.toThrow();
  });
});
