// tslint:disable:no-any strict-type-checking no-object-literal-keys-are-number

export class M24a {
    private readonly _seed: number;
    private readonly _ghostSimilarity: number;

    constructor(seed: number, ghostSimilarity: number) {
        this._seed = seed;
        this._ghostSimilarity = ghostSimilarity;
    }

    public get seed(): number {
        return this._seed;
    }

    public get ghostSimilarity(): number {
        return this._ghostSimilarity;
    }
}

export function challengeMatchmakingSeedGhostSimilarity(
    player1: { id: string; score: number },
    player2: { id: string; score: number },
    mlEnabled: boolean,
): [number, number] | null {
    if (!mlEnabled) return null;

    const seed = Math.floor(Math.random() * 1000000);
    const ghostSimilarity = this.calculateGhostSimilarity(player1.score, player2.score);

    const boundedNudge = Math.max(0, Math.min(1, (seed + ghostSimilarity) / 2000000));

    return [seed, boundedNudge];
}

function calculateGhostSimilarity(score1: number, score2: number): number {
    if (score1 === score2) return 1;

    const difference = Math.abs(score1 - score2);
    const maxScore = Math.max(score1, score2);

    return 1 / (difference + 1) * maxScore;
}

export function auditHash(
    player1: { id: string; score: number },
    player2: { id: string; score: number },
): string {
    const seed = challengeMatchmakingSeedGhostSimilarity(player1, player2, true)[0];
    return `${player1.id}-${player2.id}-${seed}`;
}
