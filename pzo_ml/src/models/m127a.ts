// tslint:disable:no-any strict-type-checking

import { M127aConfig } from './M127aConfig';
import { FragmentValuator } from './FragmentValuator';
import { RecipeDiscovery } from './RecipeDiscovery';

export class M127a {
  private readonly config: M127aConfig;
  private readonly fragmentValuator: FragmentValuator;
  private readonly recipeDiscovery: RecipeDiscovery;

  constructor(config: M127aConfig) {
    this.config = config;
    this.fragmentValuator = new FragmentValuator();
    this.recipeDiscovery = new RecipeDiscovery();
  }

  public async craftProofBoundRecipe(
    fragments: number[],
    auditHash: string,
    mlEnabled: boolean
  ): Promise<[number[], string]> {
    if (!mlEnabled) {
      return [fragments, ''];
    }

    const boundedFragments = this.boundedNudge(fragments);
    const fragmentValues = await this.fragmentValuator.evaluate(boundedFragments, auditHash);

    const recipe = await this.recipeDiscovery.discoverRecipe(fragmentValues, auditHash);
    if (!recipe) {
      return [fragments, ''];
    }

    return [boundedFragments, JSON.stringify(recipe)];
  }

  private boundedNudge(fragments: number[]): number[] {
    const nudgedFragments = fragments.map((fragment) => Math.min(Math.max(fragment, 0), 1));
    return nudgedFragments;
  }
}

export { M127aConfig } from './M127aConfig';
export { FragmentValuator } from './FragmentValuator';
export { RecipeDiscovery } from './RecipeDiscovery';

// tslint:enable:no-any strict-type-checking
