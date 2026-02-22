import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import ProofCardGeneratedOnRunComplete from '../ProofCardGeneratedOnRunComplete';

describe('Proof card generated on run complete', () => {
  it('renders proof card with SHA256 hash visible when run completes', async () => {
    const run = {
      id: 'run-id',
      status: 'completed',
      result: {
        sha256: 'sha256-hash',
      },
    };

    render(<ProofCardGeneratedOnRunComplete run={run} />);

    expect(screen.getByText('SHA256 Hash')).toBeInTheDocument();
    expect(screen.getByText(run.result.sha256)).toBeInTheDocument();
  });
});
