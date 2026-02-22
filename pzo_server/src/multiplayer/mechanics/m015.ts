// tslint:disable:no-any strict-type-checking no-object-literal-types
// tslint:enable:no-any strict-type-checking no-object-literal-types

import { SocialChaosToken } from './social_chaos_token';
import { Player } from '../player';
import { Game } from '../../game';

export class M015 {
  private mlEnabled = false;
  private auditHash: string;

  constructor(private game: Game) {}

  public getSocialChaosTokens(): SocialChaosToken[] {
    const tokens: SocialChaosToken[] = [];

    for (const player of this.game.players) {
      if (player.isCoauthor()) {
        const token = new SocialChaosToken(player);
        tokens.push(token);
      }
    }

    return tokens;
  }

  public getSocialChaosTokensCount(): number {
    return this.getSocialChaosTokens().length;
  }

  public isSocialChaosTokensEnabled(): boolean {
    return this.game.settings.social_chaos_tokens_enabled;
  }

  public getBoundedSocialChaosTokensCount(max: number): number {
    const count = this.getSocialChaosTokensCount();
    return Math.min(count, max);
  }
}
