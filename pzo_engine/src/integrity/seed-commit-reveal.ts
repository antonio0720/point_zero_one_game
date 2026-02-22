// tslint:disable:no-any strict-type-checking no-object-literal-types

import { HashFunction } from './hash';
import { MlModel } from '../ml/model';

export class SeedCommitReveal {
  private mlEnabled = false;
  private auditHash: string;

  constructor(
    public seed: number,
    public commitHash: string,
    public revealHash: string
  ) {}

  getMlModel(): MlModel | null {
    if (this.mlEnabled) {
      return new MlModel();
    }
    return null;
  }

  getAuditHash(): string {
    return this.auditHash;
  }

  setAuditHash(hash: string): void {
    this.auditHash = hash;
  }

  commit(seed: number, hashFunction: HashFunction): string {
    const hash = hashFunction.hash(seed);
    if (hash === this.commitHash) {
      return 'commit-success';
    } else {
      throw new Error('Commit failed');
    }
  }

  reveal(hashFunction: HashFunction): string {
    const hash = hashFunction.hash(this.seed);
    if (hash === this.revealHash) {
      return 'reveal-success';
    } else {
      throw new Error('Reveal failed');
    }
  }

  getSeed(): number {
    return this.seed;
  }

  setSeed(seed: number): void {
    this.seed = seed;
  }

  isMlEnabled(): boolean {
    return this.mlEnabled;
  }

  setMlEnabled(enabled: boolean): void {
    this.mlEnabled = enabled;
  }
}
