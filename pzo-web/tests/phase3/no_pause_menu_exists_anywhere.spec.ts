import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import App from '../src/App';

describe('No pause menu exists anywhere', () => {
  it('should not have any pause buttons', async () => {
    render(<App />);
    const pauseButton = await screen.findByRole('button', { name: /pause/i });
    expect(pauseButton).not.toBeInTheDocument();
  });

  it('should not have any pause modals', async () => {
    render(<App />);
    const pauseModal = await screen.findByRole('dialog', { name: /pause/i });
    expect(pauseModal).not.toBeInTheDocument();
  });
});
