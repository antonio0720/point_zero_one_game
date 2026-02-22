// tslint:disable:no-any strict-type-checking no-object-literal-types

import { M117TableFeedRunMomentsAsASocialTimelineMechanics } from './m117-table-feed-run-moments-as-a-social-timeline-mechanics';

export class M117TableFeedRunMomentsAsASocialTimelineMultiplayerCoOpRules {
  private mlEnabled: boolean;
  private auditHash: string;

  constructor(mlEnabled: boolean, auditHash: string) {
    this.mlEnabled = mlEnabled;
    this.auditHash = auditHash;
  }

  public getMechanics(): M117TableFeedRunMomentsAsASocialTimelineMechanics[] {
    return [
      new M117TableFeedRunMomentsAsASocialTimelineMechanics(
        'table_feed_run_moments_as_a_social_timeline',
        this.mlEnabled,
        (output: number) => Math.min(Math.max(output, 0), 1),
        this.auditHash
      ),
    ];
  }
}

export class M117TableFeedRunMomentsAsASocialTimelineMechanics {
  private name: string;
  private mlEnabled: boolean;
  private outputBoundedFunction: (output: number) => number;
  private auditHash: string;

  constructor(
    name: string,
    mlEnabled: boolean,
    outputBoundedFunction: (output: number) => number,
    auditHash: string
  ) {
    this.name = name;
    this.mlEnabled = mlEnabled;
    this.outputBoundedFunction = outputBoundedFunction;
    this.auditHash = auditHash;
  }

  public getName(): string {
    return this.name;
  }

  public isMLEnabled(): boolean {
    return this.mlEnabled;
  }

  public getOutputBoundedFunction(): (output: number) => number {
    return this.outputBoundedFunction;
  }

  public getAuditHash(): string {
    return this.auditHash;
  }
}
