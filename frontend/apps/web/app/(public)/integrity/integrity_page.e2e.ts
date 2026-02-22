import { describe, it, expect, beforeEach, afterEach } from 'vitest';

describe('Integrity Page', () => {
  beforeEach(async () => {
    await page.goto('/integrity');
  });

  it('renders the route correctly', async () => {
    const title = await page.$eval('#page-title', (element) => element.innerText);
    expect(title).toEqual('Integrity');
  });

  it('CTAs resolve correctly', async () => {
    const contactCta = await page.$('#contact-cta');
    const learnMoreCta = await page.$('#learn-more-cta');

    expect(contactCta).toBeTruthy();
    expect(learnMoreCta).toBeTruthy();
  });

  it('diagram loads correctly', async () => {
    const diagram = await page.$('#integrity-diagram');
    expect(diagram).toBeTruthy();
  });

  it('SEO meta is present', async () => {
    const titleMeta = await page.$eval('meta[name="title"]', (element) => element.getAttribute('content'));
    const descriptionMeta = await page.$eval('meta[name="description"]', (element) => element.getAttribute('content'));

    expect(titleMeta).toEqual('Integrity | Point Zero One Digital');
    expect(descriptionMeta).toContain('Learn about our commitment to integrity in our financial roguelike game, Sovereign.');
  });

  afterEach(async () => {
    // Clean up any resources created during the test
  });
});
