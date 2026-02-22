// loader.ts

import { Card } from '../cards/card';
import { CatalogDeck } from './catalog-deck';
import { TemplateLookup } from './template-lookup';
import { SeedableShuffle } from './seedable-shuffle';

export class CardsLoader {
  private readonly templateLookup: TemplateLookup;
  private readonly seedableShuffle: SeedableShuffle;

  constructor(templateLookup: TemplateLookup, seedableShuffle: SeedableShuffle) {
    this.templateLookup = templateLookup;
    this.seedableShuffle = seedableShuffle;
  }

  public async loadCatalogDecks(): Promise<CatalogDeck[]> {
    const catalogDecks = await CatalogDeck.loadAll();
    return catalogDecks.sort((a, b) => a.name.localeCompare(b.name));
  }

  public async loadCardInstances(card: Card): Promise<Card[]> {
    if (!mlEnabled) {
      return [card];
    }
    const templateLookup = this.templateLookup;
    const seedableShuffle = this.seedableShuffle;

    // Load card templates
    const cardTemplates = await templateLookup.lookup(card.name);

    // Shuffle and sample from the templates
    const shuffledCardTemplates = seedableShuffle.shuffle(cardTemplates);
    const sampledCardTemplates = shuffledCardTemplates.slice(0, Math.min(shuffledCardTemplates.length, 1));

    // Create card instances from the sampled templates
    const cardInstances: Card[] = [];
    for (const template of sampledCardTemplates) {
      const cardInstance = await Card.fromTemplate(template);
      cardInstances.push(cardInstance);
    }

    return cardInstances;
  }
}

export { CardsLoader };
