// tslint:disable:no-any strict-type-checking no-empty-interface
export class M076ContractVotingModes {
    private readonly mlEnabled: boolean;
    private readonly mlAuditHash: string;

    constructor(mlEnabled: boolean, mlAuditHash: string) {
        this.mlEnabled = mlEnabled;
        this.mlAuditHash = mlAuditHash;
    }

    public getMlEnabled(): boolean {
        return this.mlEnabled;
    }

    public getMlAuditHash(): string {
        return this.mlAuditHash;
    }
}

export class M076ContractVotingModesUnanimous implements IM076ContractVotingModes {
    private readonly mlEnabled: boolean;
    private readonly mlAuditHash: string;

    constructor(mlEnabled: boolean, mlAuditHash: string) {
        this.mlEnabled = mlEnabled;
        this.mlAuditHash = mlAuditHash;
    }

    public getMlEnabled(): boolean {
        return this.mlEnabled;
    }

    public getMlAuditHash(): string {
        return this.mlAuditHash;
    }
}

export class M076ContractVotingModesMajority implements IM076ContractVotingModes {
    private readonly mlEnabled: boolean;
    private readonly mlAuditHash: string;

    constructor(mlEnabled: boolean, mlAuditHash: string) {
        this.mlEnabled = mlEnabled;
        this.mlAuditHash = mlAuditHash;
    }

    public getMlEnabled(): boolean {
        return this.mlEnabled;
    }

    public getMlAuditHash(): string {
        return this.mlAuditHash;
    }
}

export class M076ContractVotingModesWeighted implements IM076ContractVotingModes {
    private readonly mlEnabled: boolean;
    private readonly mlAuditHash: string;

    constructor(mlEnabled: boolean, mlAuditHash: string) {
        this.mlEnabled = mlEnabled;
        this.mlAuditHash = mlAuditHash;
    }

    public getMlEnabled(): boolean {
        return this.mlEnabled;
    }

    public getMlAuditHash(): string {
        return this.mlAuditHash;
    }
}

export interface IM076ContractVotingModes {
    getMlEnabled(): boolean;
    getMlAuditHash(): string;
}
