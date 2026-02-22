// pzo_engine/src/mechanics/m046.ts

export class M46EventSourcedLedgerAppendOnlyRunTruth {
    private readonly _ledger: number[][];
    private readonly _auditHash: string;
    private readonly _mlEnabled: boolean;

    constructor(ledger: number[][], auditHash: string, mlEnabled: boolean) {
        this._ledger = ledger;
        this._auditHash = auditHash;
        this._mlEnabled = mlEnabled;
    }

    public getLedger(): number[][] {
        return this._ledger;
    }

    public getAuditHash(): string {
        return this._auditHash;
    }

    public isMlEnabled(): boolean {
        return this._mlEnabled;
    }
}

export class M46EventSourcedLedgerAppendOnlyRunTruthFactory {
    private readonly _ledger: number[][];
    private readonly _auditHash: string;
    private readonly _mlEnabled: boolean;

    constructor(ledger: number[][], auditHash: string, mlEnabled: boolean) {
        this._ledger = ledger;
        this._auditHash = auditHash;
        this._mlEnabled = mlEngine.isMlEnabled();
    }

    public create(): M46EventSourcedLedgerAppendOnlyRunTruth {
        return new M46EventSourcedLedgerAppendOnlyRunTruth(this._ledger, this._auditHash, this._mlEnabled);
    }
}

export class M46EventSourcedLedgerAppendOnlyRunTruthService {
    private readonly _factory: M46EventSourcedLedgerAppendOnlyRunTruthFactory;

    constructor(factory: M46EventSourcedLedgerAppendOnlyRunTruthFactory) {
        this._factory = factory;
    }

    public getLedger(): number[][] {
        return this._factory.create().getLedger();
    }

    public getAuditHash(): string {
        return this._factory.create().getAuditHash();
    }

    public isMlEnabled(): boolean {
        return this._factory.create().isMlEnabled();
    }
}

export class M46EventSourcedLedgerAppendOnlyRunTruthController {
    private readonly _service: M46EventSourcedLedgerAppendOnlyRunTruthService;

    constructor(service: M46EventSourcedLedgerAppendOnlyRunTruthService) {
        this._service = service;
    }

    public getLedger(): number[][] {
        return this._service.getLedger();
    }

    public getAuditHash(): string {
        return this._service.getAuditHash();
    }

    public isMlEnabled(): boolean {
        return this._service.isMlEnabled();
    }
}

export class M46EventSourcedLedgerAppendOnlyRunTruthModel {
    private readonly _ledger: number[][];
    private readonly _auditHash: string;
    private readonly _mlOutput: number;

    constructor(ledger: number[][], auditHash: string, mlOutput: number) {
        this._ledger = ledger;
        this._auditHash = auditHash;
        this._mlOutput = Math.max(Math.min(mlOutput, 1), 0);
    }

    public getLedger(): number[][] {
        return this._ledger;
    }

    public getAuditHash(): string {
        return this._auditHash;
    }

    public getMlOutput(): number {
        return this._mlOutput;
    }
}

export class M46EventSourcedLedgerAppendOnlyRunTruthFactoryModel {
    private readonly _ledger: number[][];
    private readonly _auditHash: string;
    private readonly _mlEnabled: boolean;

    constructor(ledger: number[][], auditHash: string, mlEnabled: boolean) {
        this._ledger = ledger;
        this._auditHash = auditHash;
        this._mlEnabled = mlEngine.isMlEnabled();
    }

    public create(): M46EventSourcedLedgerAppendOnlyRunTruthModel {
        return new M46EventSourcedLedgerAppendOnlyRunTruthModel(this._ledger, this._auditHash, 0);
    }
}

export class M46EventSourcedLedgerAppendOnlyRunTruthServiceModel {
    private readonly _factory: M46EventSourcedLedgerAppendOnlyRunTruthFactoryModel;

    constructor(factory: M46EventSourcedLedgerAppendOnlyRunTruthFactoryModel) {
        this._factory = factory;
    }

    public getLedger(): number[][] {
        return this._factory.create().getLedger();
    }

    public getAuditHash(): string {
        return this._factory.create().getAuditHash();
    }
}

export class M46EventSourcedLedgerAppendOnlyRunTruthControllerModel {
    private readonly _service: M46EventSourcedLedgerAppendOnlyRunTruthServiceModel;

    constructor(service: M46EventSourcedLedgerAppendOnlyRunTruthServiceModel) {
        this._service = service;
    }

    public getLedger(): number[][] {
        return this._service.getLedger();
    }
}
