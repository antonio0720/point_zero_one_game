// @ts-check

import { M149Config } from './M149_config';
import { M149State } from './M149_state';
import { M149Action } from './M149_action';

export class M149 {
  private config: M149Config;
  private state: M149State;

  constructor(config: M149Config, state: M149State) {
    this.config = config;
    this.state = state;
  }

  public update(action: M149Action): void {
    if (this.state.regulatoryWindowActive && action.type === 'comply') {
      // If the player complies, reset the regulatory window
      this.state.regulatoryWindowActive = false;
      this.state.finesPaid = 0;
    } else if (!this.state.regulatoryWindowActive && action.type === 'payFine') {
      // If the player pays a fine, increment their fines paid and set the regulatory window active
      this.state.finesPaid++;
      this.state.regulatoryWindowActive = true;
    }
  }

  public getAuditHash(): string {
    return JSON.stringify({
      config: this.config,
      state: this.state,
    });
  }

  public isMLModelEnabled(): boolean {
    return false; // Regulatory window does not use ML models
  }

  public getOutput(): number[] {
    if (this.state.regulatoryWindowActive) {
      return [1];
    } else {
      return [0];
    }
  }
}

export { M149Config, M149State, M149Action };
