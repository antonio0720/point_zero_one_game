/**
 * Compatibility Resolver Service for Entitlements in Ranked Contexts
 */

import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Document } from 'mongoose';
import { TaxonomyDocument } from '../taxonomy/schemas/taxonomy.schema';
import { EntitlementDocument } from './schemas/entitlement.schema';
import { CompatibilityEventEmitter } from './compatibility-event.emitter';

/**
 * Entitlement compatibility taxonomy document type
 */
export interface Taxonomy extends Document {
  id: string;
  name: string;
  parentId?: string;
}

/**
 * Entitlement compatibility document type
 */
export interface Entitlement extends Document {
  id: string;
  taxonomyId: string;
  rank: number;
  compatibleWith: string[];
}

/**
 * Compatibility Resolver Service
 */
@Injectable()
export class CompatibilityResolverService {
  constructor(
    @InjectModel('Entitlement') private entitlementModel: Model<Entitlement>,
    @InjectModel('Taxonomy') private taxonomyModel: Model<Taxonomy>,
    private compatibilityEventEmitter: CompatibilityEventEmitter,
  ) {}

  /**
   * Resolve entitlement compatibility for ranked contexts based on taxonomy.
   * Cache results and emit incompat events.
   */
  async resolveCompatibilities(taxonomyId: string): Promise<void> {
    // Fetch all entitlements under the given taxonomy
    const entitlements = await this.entitlementModel.find({ taxonomyId }).exec();

    // Cache compatibility results for each entitlement
    const compatibilityCache: Record<string, Set<string>> = {};
    entitlements.forEach((entitlement) => {
      if (!compatibilityCache[entitlement.id]) {
        compatibilityCache[entitlement.id] = new Set(entitlement.compatibleWith);
      } else {
        entitlement.compatibleWith.forEach((id) => compatibilityCache[entitlement.id].add(id));
      }
    });

    // Iterate through all pairs of entitlements and check for incompatibilities
    for (let i = 0; i < entitlements.length; i++) {
      const currentEntitlement = entitlements[i];
      for (let j = i + 1; j < entitlements.length; j++) {
        const otherEntitlement = entitlements[j];
        if (currentEntitlement.id !== otherEntitlement.id) {
          // Check if the current and other entitlement are incompatible
          if (!compatibilityCache[currentEntitlement.id].has(otherEntitlement.id)) {
            // Emit an incompat event for the pair of entitlements
            this.compatibilityEventEmitter.emitIncompatEvent({
              id1: currentEntitlement.id,
              id2: otherEntitlement.id,
            });
          }
        }
      }
    }
  }
}
