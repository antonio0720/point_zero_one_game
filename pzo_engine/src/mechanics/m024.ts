// pzo_engine/src/mechanics/m024.ts

export class ChallengeLinksSeedDecisionGhosts {
    private seed: number;
    private decisionGhostCount: number;

    constructor(seed: number, decisionGhostCount: number) {
        this.seed = seed;
        this.decisionGhostCount = decisionGhostCount;
    }

    public getChallengeLink(): [number, number] {
        const random = Math.floor(Math.random() * 100);
        if (random < 50) {
            return [this.seed, this.decisionGhostCount];
        } else {
            return [this.seed + 1, this.decisionGhostCount - 1];
        }
    }

    public getAuditHash(): string {
        const hash = crypto.createHash('sha256');
        hash.update(this.seed.toString());
        hash.update(this.decisionGhostCount.toString());
        return hash.digest('hex');
    }
}

export function challengeLinksSeedDecisionGhosts(
    seed: number,
    decisionGhostCount: number
): ChallengeLinksSeedDecisionGhosts {
    return new ChallengeLinksSeedDecisionGhosts(seed, decisionGhostCount);
}
