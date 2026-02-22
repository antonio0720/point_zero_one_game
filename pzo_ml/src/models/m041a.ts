// tslint:disable:no-any strict-type-checking
import { BoundedNudge } from '../bounded_nudge';
import { AuditHash } from '../audit_hash';

export class M41a {
  private readonly _mlEnabled: boolean;
  private readonly _boundedNudge: BoundedNudge;

  constructor(mlEnabled: boolean, boundedNudge: BoundedNudge) {
    this._mlEnabled = mlEnabled;
    this._boundedNudge = boundedNudge;
  }

  public estimateSkill(bootRunTime: number): [number, AuditHash] | null {
    if (!this._mlEnabled) return null;

    const bootRunClassifier = new BootRunClassifier();
    const skillEstimate = bootRunClassifier.classify(bootRunTime);

    const boundedNudgeValue = this._boundedNudge.nudge(skillEstimate);
    const auditHash = AuditHash.hash(boundedNudgeValue.toString());

    return [boundedNudgeValue, auditHash];
  }
}

class BootRunClassifier {
  private readonly _classifier: number;

  constructor() {
    // Initialize the classifier with a random value (for demonstration purposes)
    this._classifier = Math.random();
  }

  public classify(bootRunTime: number): number {
    return bootRunTime / 90;
  }
}

export function createM41a(mlEnabled: boolean, boundedNudge: BoundedNudge): M41a {
  return new M41a(mlEnabled, boundedNudge);
}
