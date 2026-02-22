import { describe, it, expect } from 'vitest';
import { page } from './page';

describe('Game loads in browser at localhost:5173', () => {
  it('game renders without errors', async () => {
    await page.goto('http://localhost:5173');
    const title = await page.title();
    expect(title).toBe('Point Zero One Digital');
  });
});
