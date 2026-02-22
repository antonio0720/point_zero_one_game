// moment_forge_three_moment_guarantee.ts
import { MlModel } from '../ml_model';
import { Engine } from '../engine';

export class MomentForgeThreeMomentGuarantee {
  private mlEnabled = false;
  private auditHash: string;

  constructor(private engine: Engine) {}

  public getMlEnabled(): boolean {
    return this.mlEnabled;
  }

  public setMlEnabled(enabled: boolean): void {
    this.mlEnabled = enabled;
  }

  public getAuditHash(): string {
    return this.auditHash;
  }

  public setAuditHash(hash: string): void {
    this.auditHash = hash;
  }

  public guaranteeMoments(playerId: number, moment1: number, moment2: number, moment3: number): [number, number] | null {
    if (!this.mlEnabled) {
      return [moment1, moment2];
    }

    const mlModel = new MlModel();
    const output = mlModel.predict([moment1, moment2, moment3]);

    if (output < 0 || output > 1) {
      throw new Error('ML model output is out of bounds');
    }

    return [moment1 + Math.floor(output), moment2 + Math.floor(output)];
  }
}

export function getMomentForgeThreeMomentGuarantee(engine: Engine): MomentForgeThreeMomentGuarantee {
  return new MomentForgeThreeMomentGuarantee(engine);
}
