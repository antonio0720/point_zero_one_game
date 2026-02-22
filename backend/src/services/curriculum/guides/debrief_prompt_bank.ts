Here is the TypeScript file `backend/src/services/curriculum/guides/debrief_prompt_bank.ts` as per your specifications:

```typescript
/**
 * Debrief Prompt Bank Service
 */

import { DebriefPromptBankEntity } from './entities/DebriefPromptBankEntity';

export interface DebriefPromptBankCreateInput {
  tag: string;
  prompt: string;
}

export interface DebriefPromptBankUpdateInput {
  id?: number;
  tag?: string;
  prompt?: string;
}

export class DebriefPromptBankService {
  private readonly db: DebriefPromptBankEntity[];

  constructor() {
    this.db = [];
  }

  public create(input: DebriefPromptBankCreateInput): void {
    const newDebriefPromptBank = new DebriefPromptBankEntity(input);
    this.db.push(newDebriefPromptBank);
  }

  public update(input: DebriefPromptBankUpdateInput): void {
    const updatedDebriefPromptBank = this.db.find((dpb) => dpb.id === input.id) || new DebriefPromptBankEntity();
    Object.assign(updatedDebrifPromptBank, input);
  }

  public findByTag(tag: string): DebriefPromptBankEntity[] {
    return this.db.filter((dpb) => dpb.tag === tag);
  }
}
