// tslint:disable:no-any strict-type-checking no-object-literal-types
// tslint:enable:no-any strict-type-checking no-object-literal-types

import { M125NoGhostHardcoreYouOwnEveryMistake } from './m125_no_ghost_hardcore_you_own_every_mistake';

export class NoGhostHardcoreYouOwnEveryMistake extends M125NoGhostHardcoreYouOwnEveryMistake {
  public readonly mlEnabled: boolean;
  public readonly auditHash: string;

  constructor() {
    super();
    this.mlEnabled = false; // default to off
    this.auditHash = '';
  }

  public getDetermination(): number {
    return 1.0;
  }
}
