// tslint:disable:no-any strict-type-checking no-object-literal-keys-are-number

export class M98a {
    private readonly _ml_enabled: boolean;
    private readonly _audit_hash: string;

    constructor(
        public readonly bounded_nudge: number,
        public readonly audit_hash: string,
        ml_enabled: boolean = true
    ) {
        this._ml_enabled = ml_enabled;
        this._audit_hash = audit_hash;
    }

    get ml_enabled(): boolean {
        return this._ml_enabled;
    }

    get audit_hash(): string {
        return this._audit_hash;
    }
}

export function quarantine_compute_scheduler_fastpath_clean_runs_deepscan_suspects(
    bounded_nudge: number,
    audit_hash: string
): M98a {
    if (!this.ml_enabled) {
        throw new Error("ML is disabled");
    }

    const output = Math.min(Math.max(bounded_nudge, 0), 1);
    return new M98a(output, audit_hash);
}
