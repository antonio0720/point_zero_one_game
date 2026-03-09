/**
 * A/B Test Service for Point Zero One Digital's financial roguelike game
 */

import { EventEmitter } from 'events';
import { Cohort, User } from '../user';

interface ABTestVariant {
  id: number;
  name: string;
}

interface ABTest {
  id: number;
  variantId: number;
  cohort: Cohort;
  createdAt: Date;
  updatedAt: Date;
}

class AbTestService extends EventEmitter {
  private variants: Map<number, ABTestVariant>;
  private tests: Map<number, ABTest>;

  constructor() {
    super();
    this.variants = new Map();
    this.tests = new Map();
  }

  /**
   * Create a new A/B test for the given variant and user
   * @param variantId - The ID of the variant to assign to the user
   * @param userId - The ID of the user being assigned to a variant
   */
  public createTest(variantId: number, userId: number): void {
    const variant = this.getVariantById(variantId);
    if (!variant) {
      throw new Error(`No variant found with id ${variantId}`);
    }

    const cohort = Cohort.fromFirstSession();
    const test: ABTest = {
      id: Math.floor(Date.now() * Math.random()),
      variantId,
      cohort,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.tests.set(test.id, test);
    this.emit('AB_TEST_ENROLLED', { userId, variantId, cohort });
  }

  /**
   * Get the A/B test for a given user ID
   * @param userId - The ID of the user to get the A/B test for
   */
  public getTestByUserId(userId: number): ABTest | undefined {
    return this.tests.get(userId);
  }

  /**
   * Get the variant for a given variant ID
   * @param variantId - The ID of the variant to get
   */
  private getVariantById(variantId: number): ABTestVariant | undefined {
    return this.variants.get(variantId);
  }

  /**
   * Add a new variant to the service
   * @param variant - The variant to add
   */
  public addVariant(variant: ABTestVariant): void {
    this.variants.set(variant.id, variant);
  }
}

export default AbTestService;
