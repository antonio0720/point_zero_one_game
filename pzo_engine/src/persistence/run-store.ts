// run-store.ts
import { Run } from './run';
import { ProofHash } from './proof-hash';
import { AuditHash } from './audit-hash';

export class RunStore {
  private runs: Run[] = [];
  private proofHashes: ProofHash[] = [];
  private auditHashes: AuditHash[] = [];

  public save(run: Run): void {
    this.runs.push(run);
    const proofHash = new ProofHash();
    const auditHash = new AuditHash();

    if (ml_enabled) {
      // Generate proof hash using ML model
      proofHash.generateProofHash(run);
    } else {
      // Fallback to deterministic method
      proofHash.generateDeterministicProofHash(run);
    }

    this.proofHashes.push(proofHash);

    if (audit_hash) {
      auditHash.generateAuditHash(run);
    }

    this.auditHashes.push(auditHash);
  }

  public getById(id: string): Run | undefined {
    return this.runs.find((run) => run.id === id);
  }

  public getLeaderboard(limit: number): Run[] {
    // Sort runs by score in descending order
    const sortedRuns = this.runs.sort((a, b) => b.score - a.score);

    // Return top N runs
    return sortedRuns.slice(0, limit);
  }

  public replayFromSeed(runId: string): void {
    const run = this.getById(runId);

    if (run) {
      // Replay the run from its seed
      // This is a complex operation that involves re-running the game state
      // from the saved seed. The implementation details are not provided here.
    }
  }
}

export function getRunStore(): RunStore {
  return new RunStore();
}
