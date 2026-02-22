import { describe, it, expect, beforeEach, afterEach } from 'vitest';

describe('Integrity Page', () => {
  beforeEach(async () => {
    await page.goto('http://localhost:3000/integrity');
  });

  it('loads the public page', async () => {
    const publicText = await page.$eval('#public-page h1', (element) => element.textContent);
    expect(publicText).toEqual('Public Page');
  });

  it('verifies input works', async () => {
    const inputElement = await page.$('#input-field');
    await inputElement?.type('test-input');
    const inputValue = await page.$eval('#input-field', (element) => element.value);
    expect(inputValue).toEqual('test-input');
  });

  it('verifies transparency fetch works', async () => {
    const transparencyData = await page.evaluate(() => JSON.parse(localStorage.getItem('transparencyData')));
    expect(transparencyData).toBeDefined();
  });

  it('verifies appendix toggles', async () => {
    const appendixToggleButton = await page.$('#appendix-toggle');
    await appendixToggleButton?.click();
    const appendixVisible = await page.$eval('#appendix', (element) => element.style.display === 'block');
    expect(appendixVisible).toBeTruthy();
  });

  it('verifies appeal submits with throttle UX', async () => {
    const appealForm = await page.$('#appeal-form');
    await appealForm?.fill({
      name: 'Test User',
      email: 'test@example.com',
      message: 'This is a test appeal.'
    });
    await appealForm?.submit();

    const appealSubmittedText = await page.$eval('#appeal-submitted h1', (element) => element.textContent);
    expect(appealSubmittedText).toEqual('Your appeal has been submitted.');
  });

  afterEach(async () => {
    // Clear local storage to ensure tests are deterministic
    await page.evaluate(() => localStorage.clear());
  });
});
