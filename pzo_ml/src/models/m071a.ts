// tslint:disable:no-any strict-type-checking no-object-literal-types

import { MlModel } from '../ml_model';
import { BoundedNudge } from './bounded_nudge';

export class M71a extends MlModel {
  private readonly _attestation: number;
  private readonly _behavior: number;
  private readonly _network: number;

  constructor(
    attestation: number,
    behavior: number,
    network: number
  ) {
    super();
    this._attestation = attestation;
    this._behavior = behavior;
    this._network = network;
  }

  public get attestation(): number {
    return this._attestation;
  }

  public get behavior(): number {
    return this._behavior;
  }

  public get network(): number {
    return this._network;
  }

  public get auditHash(): string {
    const hash = crypto.createHash('sha256');
    hash.update(JSON.stringify(this));
    return hash.digest('hex');
  }

  public get mlEnabled(): boolean {
    return true; // default to enabled
  }

  public setMlEnabled(enabled: boolean): void {
    this.ml_enabled = enabled;
  }

  private _ml_enabled: boolean;

  public get ml_enabled(): boolean {
    return this._ml_enabled;
  }

  public set ml_enabled(value: boolean) {
    this._ml_enabled = value;
  }

  public get boundedNudge(): BoundedNudge {
    const nudge = new BoundedNudge(0, 1);
    if (this.mlEnabled) {
      // apply ML model to determine nudge
      nudge.value = Math.min(Math.max(this.attestation + this.behavior + this.network, 0), 1);
    }
    return nudge;
  }

  public get boundedNudges(): BoundedNudge[] {
    const nudges: BoundedNudge[] = [];
    for (let i = 0; i < 10; i++) {
      nudges.push(this.boundedNudge.clone());
    }
    return nudges;
  }
}
