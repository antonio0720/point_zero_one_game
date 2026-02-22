import { describe, it, expect } from 'vitest';
import { compileAndLoadCatalog } from '../../../src/phase1/card_catalog';

describe('card catalog parses 360 cards', () => {
  it('compiles and loads printable catalog with 360 templates', async () => {
    const catalog = await compileAndLoadCatalog();
    expect(catalog.templates.length).toBe(360);
  });

  it('has unique ids for all templates', async () => {
    const catalog = await compileAndLoadCatalog();
    const templateIds = new Set(catalog.templates.map(template => template.id));
    expect(templateIds.size).toBe(catalog.templates.length);
  });

  it('validates Econ blocks for all templates', async () => {
    const catalog = await compileAndLoadCatalog();
    for (const template of catalog.templates) {
      expect(template.econBlock).not.toBeNull();
    }
  });
});
