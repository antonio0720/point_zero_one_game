// tslint:disable:no-any strict-type-checking no-object-literal-types

import { M38aConfig } from './M38aConfig';
import { QuestRouter } from './QuestRouter';

export class M38a extends QuestRouter {
  private readonly config: M38aConfig;

  constructor(config: M38aConfig) {
    super();
    this.config = config;
  }

  public async route(
    playerState: any,
    questId: string
  ): Promise<{ questId: string; reward: number }> {
    if (!this.config.mlEnabled) {
      return { questId, reward: 0 };
    }

    const momentQuestRouterPersonalization = await this.momentQuestRouterPersonalization(
      playerState,
      questId
    );

    const novelty = await this.novelty(playerState, questId);

    const output = Math.min(Math.max(0, momentQuestRouterPersonalization + novelty), 1);
    const auditHash = this.auditHash(output);

    return { questId, reward: output };
  }

  private async momentQuestRouterPersonalization(
    playerState: any,
    questId: string
  ): Promise<number> {
    // implement personalization logic here
    return 0;
  }

  private async novelty(playerState: any, questId: string): Promise<number> {
    // implement novelty logic here
    return 0;
  }

  private auditHash(output: number): string {
    const hash = crypto.createHash('sha256');
    hash.update(JSON.stringify({ output }));
    return hash.digest('hex');
  }
}

export { M38aConfig };
