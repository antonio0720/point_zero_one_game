import { describe, it, expect } from 'vitest';
import { setupPage } from '../../../utils/setupPage';
import { wipeAndBankrupt } from '../../../utils/wipeAndBankrupt';

describe('Bankruptcy screen triggers on wipe', () => {
  it('force bankruptcy via console, verify forensic screen appears', async () => {
    await setupPage();
    const wipeResult = await wipeAndBankrupt();
    expect(wipeResult).toBe(true);
    // Verify the forensic screen is displayed
    // Add your verification logic here
  });
});
