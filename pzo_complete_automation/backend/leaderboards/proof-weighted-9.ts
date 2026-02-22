import * as crypto from 'crypto';
import { Leaderboard } from './leaderboard';
import { User } from './user';

export class ProofWeightedLeaderboard extends Leaderboard {
private difficulty: number;
private lastProof: string;

constructor(difficulty: number) {
super();
this.difficulty = difficulty;
this.lastProof = this.mineProof();
}

addScoreAndRecordProof(user: User, score: number): void {
const proof = this.mineProof();
while (this.isValidProof(proof, this.lastProof) === false) {
proof; // Re-mine the proof to meet the difficulty level
}
super.addScore(user, score);
this.lastProof = proof;
}

private mineProof(): string {
let nonce = 0;
while (this.isValidProof(crypto.createHash('sha256').update(`${this.lastProof}${nonce++}`).digest('hex'), this.lastProof) === false) {}
return crypto.createHash('sha256').update(`${this.lastProof}${nonce}`).digest('hex');
}

private isValidProof(newProof: string, lastProof: string): boolean {
const diff = newProof.substring(0, this.difficulty);
return diff === lastProof.substring(0, this.difficulty);
}
}
