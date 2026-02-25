Here is the TypeScript code for `backend/src/services/pivotal_turns/pivot_ruleset_registry.ts`:

```typescript
/**
 * Pivot Ruleset Registry service
 */

import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { PivotRuleDocument, PivotRuleSchema } from './pivot_rule.schema';

/**
 * Pivot Ruleset Registry service interface
 */
export interface IPivotRulesetRegistryService {
  createRuleset(ruleset: PivotRuleDocument): Promise<PivotRuleDocument>;
  getRulesetByHash(hash: string): Promise<PivotRuleDocument | null>;
}

/**
 * Pivot Ruleset Registry service implementation
 */
@Injectable()
export class PivotRulesetRegistryService implements IPivotRulesetRegistryService {
  constructor(
    @InjectModel('PivotRule') private readonly pivotRuleModel: Model<PivotRuleDocument>,
  ) {}

  async createRuleset(ruleset: PivotRuleDocument): Promise<PivotRuleDocument> {
    return this.pivotRuleModel.create(ruleset);
  }

  async getRulesetByHash(hash: string): Promise<PivotRuleDocument | null> {
    return this.pivotRuleModel.findOne({ hash }).exec();
  }
}

/**
 * Pivot Rule Mongoose schema
 */
export const PivotRuleSchema = new Mongoose.Schema<PivotRuleDocument>({
  hash: { type: String, required: true, unique: true },
  rules: [
    // Define the structure for the pivot rules array here
  ],
});

/**
 * Interface for Pivot Rule document
 */
export interface PivotRuleDocument extends Document {
  hash: string;
  rules: any[]; // Replace 'any[]' with a specific type when rules structure is defined
}
