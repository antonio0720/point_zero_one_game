// pzo_ml/src/models/m123a.ts

export class M123a {
    private readonly _mlEnabled: boolean;
    private readonly _auditHash: string;

    constructor(mlEnabled: boolean, auditHash: string) {
        this._mlEnabled = mlEnabled;
        this._auditHash = auditHash;
    }

    public get mlEnabled(): boolean {
        return this._mlEnabled;
    }

    public get auditHash(): string {
        return this._auditHash;
    }

    public getOutput(input: number): number {
        if (!this.mlEnabled) {
            throw new Error("ML is disabled");
        }
        
        // bounded nudges
        const output = Math.max(0, Math.min(1, input));
        
        // audit hash
        const auditHash = crypto.createHash('sha256').update(output.toString()).digest('hex');
        
        return output;
    }
}
