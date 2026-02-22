// tslint:disable:no-any strict-type-checking no-object-literal-keys-are-number

import { M141Config } from './M141Config';
import { M141State } from './M141State';
import { M141Action } from './M141Action';
import { Engine } from '../Engine';

export class M141 {
  private config: M141Config;
  private state: M141State;

  constructor(config: M141Config, engine: Engine) {
    this.config = config;
    this.state = new M141State(engine);
  }

  public async init(): Promise<void> {
    await this.state.init();
  }

  public async update(deltaTime: number): Promise<void> {
    if (this.config.friendsVoteLater) {
      // Asynchronous table logic
      const voteResults = await this.state.getVoteResults();
      if (voteResults.length > 0) {
        // Process votes and update state accordingly
        this.state.processVotes(voteResults);
      }
    }

    // Timer-bound logic
    this.state.updateTimer(deltaTime);

    // Preserve determinism by ensuring the same sequence of actions is taken every time
    const action = this.state.getAction();
    if (action !== null) {
      await this.takeAction(action);
    }
  }

  private async takeAction(action: M141Action): Promise<void> {
    switch (action.type) {
      case 'VOTE':
        // Handle vote action
        break;
      case 'TIMER_EXPIRED':
        // Handle timer expired action
        break;
      default:
        throw new Error(`Unknown action type: ${action.type}`);
    }
  }

  public async getAuditHash(): Promise<string> {
    return this.state.getAuditHash();
  }

  public isMlEnabled(): boolean {
    return false; // M141 does not use ML models
  }

  public getBoundedOutput(): number {
    return Math.min(Math.max(this.state.getTimerValue(), 0), 1);
  }
}

export { M141Config, M141State, M141Action };
