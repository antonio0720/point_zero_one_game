// tslint:disable:no-any strict-type-checking no-object-literal-types

import { MlModel } from './MlModel';
import { BoundedNudge } from './BoundedNudge';

export class M57a extends MlModel {
  private readonly mlEnabled: boolean;
  private readonly boundedNudges: BoundedNudge[];
  private readonly auditHash: string;

  constructor(
    mlEnabled: boolean,
    boundedNudges: BoundedNudge[],
    auditHash: string
  ) {
    super();
    this.mlEnabled = mlEnabled;
    this.boundedNudges = boundedNudges;
    this.auditHash = auditHash;
  }

  public getMlEnabled(): boolean {
    return this.mlEnabled;
  }

  public getBoundedNudges(): BoundedNudge[] {
    return this.boundedNudges;
  }

  public getAuditHash(): string {
    return this.auditHash;
  }
}

export function createM57a(
  mlEnabled: boolean,
  boundedNudges: BoundedNudge[],
  auditHash: string
): M57a {
  if (!mlEnabled) {
    throw new Error('ML is disabled');
  }

  const model = new M57a(mlEnabled, boundedNudges, auditHash);

  // Ensure outputs are within bounds (0-1)
  for (const nudge of model.getBoundedNudges()) {
    if (!(nudge.min <= nudge.value && nudge.value <= nudge.max)) {
      throw new Error('Nudge value out of bounds');
    }
  }

  return model;
}
