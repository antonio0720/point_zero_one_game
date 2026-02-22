export abstract class MLModel {
    protected _auditHash: string;
    private _mlEnabled: boolean;

    constructor(auditHash?: string) {
        this._auditHash = auditHash || '';
        this._mlEnabled = true; // default to enabled, can be toggled via env var or config
    }

    get mlEnabled(): boolean {
        return this._mlEnabled;
    }

    set mlEnabled(value: boolean) {
        this._mlEnabled = value;
    }

    protected _clampOutput(output: number): number {
        if (output < 0 || output > 1) {
            throw new Error('ML model output must be between 0 and 1');
        }
        return Math.min(Math.max(output, 0), 1);
    }

    public abstract buildTopFactors(): { [key: string]: number };

    protected _buildAuditHash(): string {
        // implement audit hash calculation here
        return this._auditHash;
    }

    public get auditHash(): string {
        if (!this.mlEnabled) {
            return null;
        }
        return this._buildAuditHash();
    }

    public abstract infer(input: any): { [key: string]: number };

    protected _logInference(input: any, output: { [key: string]: number }): void {
        // implement logging here
    }

    public inferWithLogging(input: any): { [key: string]: number } {
        if (!this.mlEnabled) {
            return null;
        }
        const result = this.infer(input);
        this._logInference(input, result);
        return result;
    }
}
