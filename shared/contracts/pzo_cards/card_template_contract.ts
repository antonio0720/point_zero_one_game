Here is the complete `card_template_contract.ts` file:

```typescript
/**
 * @file CardTemplate contract and related types.
 */

import { z } from 'zod';

// Enums
export enum DeckType {
  /**
   * Standard deck type.
   */
  STANDARD = 'standard',
  /**
   * Draft deck type.
   */
  DRAFT = 'draft',
}

// Types
export interface CardTemplate {
  /**
   * Unique identifier for the card template.
   */
  id: string;
  /**
   * Name of the card template.
   */
  name: string;
  /**
   * Description of the card template.
   */
  description?: string;
  /**
   * List of card IDs that make up this template.
   */
  cards: string[];
}

export interface EconBlock {
  /**
   * Unique identifier for the econ block.
   */
  id: string;
  /**
   * Name of the econ block.
   */
  name: string;
  /**
   * Description of the econ block.
   */
  description?: string;
  /**
   * List of card IDs that make up this template.
   */
  cards: string[];
}

// Schema
export const CardTemplateSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  description: z.string().optional(),
  cards: z.array(z.string()),
});

export const EconBlockSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  description: z.string().optional(),
  cards: z.array(z.string()),
});

// Validator
export function validateCardTemplate(cardTemplate: CardTemplate) {
  return CardTemplateSchema.parse(cardTemplate);
}

export function validateEconBlock(econBlock: EconBlock) {
  return EconBlockSchema.parse(econBlock);
}
```

This file exports the `DeckType` enum, `CardTemplate` and `EconBlock` interfaces, as well as the `CardTemplateSchema` and `EconBlockSchema` Zod schemas. It also includes two validator functions: `validateCardTemplate` and `validateEconBlock`.
