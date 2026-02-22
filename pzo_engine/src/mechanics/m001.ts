// pzo_engine/src/mechanics/m001.ts

export class RunSeedDeterministicReplayMechanic {
    private seed: number;
    private mlEnabled: boolean;

    constructor(seed: number, mlEnabled: boolean) {
        this.seed = seed;
        this.mlEnabled = mlEnabled;
    }

    public run(): void {
        // Set the random seed for determinism
        Math.seedrandom(this.seed.toString());

        // Disable ML models to ensure deterministic behavior
        if (this.mlEnabled) {
            console.warn("ML models are enabled, but we're in a deterministic replay. Disabling...");
            this.mlEnabled = false;
        }

        // Run the game logic with the set seed and disabled ML models
        // This will produce the same output every time it's run with the same seed
    }
}

export function getAuditHash(): string {
    const hash = crypto.createHash('sha256');
    hash.update(this.seed.toString());
    return hash.digest('hex');
}
