// pzo_ml/src/models/m020a.ts

export class M20aMacroShockGenerator {
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

    public generateMacroShock(): number[] {
        if (!this.mlEnabled) {
            throw new Error("ML is disabled");
        }

        const boundedNudge = Math.random() * 0.2 - 0.1; // bounded nudges between -10% and +10%
        const macroShock = this._generateMacroShock();

        return [macroShock, boundedNudge];
    }

    private _generateMacroShock(): number {
        // implementation of the Macro Shock Generator
        // for demonstration purposes, a simple random value is used
        return Math.random();
    }
}

export function getM20aMacroShockGenerator(mlEnabled: boolean, auditHash: string): M20aMacroShockGenerator {
    return new M20aMacroShockGenerator(mlEnabled, auditHash);
}
