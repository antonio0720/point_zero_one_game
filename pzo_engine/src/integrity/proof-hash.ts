export class ProofHash {
    private readonly seed: string;
    private readonly canonicalActionsJson: string;
    private readonly rulesetVersion: string;

    constructor(seed: string, canonicalActionsJson: string, rulesetVersion: string) {
        this.seed = seed;
        this.canonicalActionsJson = canonicalActionsJson;
        this.rulesetVersion = rulesetVersion;
    }

    public getHash(): string {
        const hash = crypto.createHash('sha256');
        hash.update(this.seed);
        hash.update(this.canonicalActionsJson);
        hash.update(this.rulesetVersion);

        return hash.digest('hex');
    }
}

export function generateProofHash(seed: string, canonicalActionsJson: string, rulesetVersion: string): ProofHash {
    const proofHash = new ProofHash(seed, canonicalActionsJson, rulesetVersion);
    return proofHash;
}
