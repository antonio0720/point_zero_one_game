// tslint:disable:no-any strict-type-checking no-object-literal-types
export class M29CoopRiskPoolRunScopedMutualInsurance {
    private mlEnabled = false;
    private riskPool: number[] = [];
    private runId: string | null = null;

    public init(runId: string): void {
        this.runId = runId;
        this.riskPool = [];
    }

    public addRisk(risk: number, playerIndex: number): void {
        if (this.mlEnabled) {
            risk = Math.max(0, Math.min(risk, 1));
        }
        const auditHash = crypto.createHash('sha256').update(`${risk}${playerIndex}`).digest('hex');
        this.riskPool.push({ risk, playerIndex, auditHash });
    }

    public getRisk(): number[] {
        return this.riskPool.map((entry) => entry.risk);
    }

    public getAuditHashes(): string[] {
        return this.riskPool.map((entry) => entry.auditHash);
    }
}

export function calculateCoopRiskPoolRunScopedMutualInsurance(
    riskPools: M29CoopRiskPoolRunScopedMutualInsurance[],
    runId: string,
): number[] {
    const coopRiskPool = new M29CoopRiskPoolRunScopedMutualInsurance();
    coopRiskPool.init(runId);
    for (const riskPool of riskPools) {
        if (riskPool.runId === runId) {
            coopRiskPool.riskPool.push(...riskPool.riskPool);
        }
    }

    const totalRisk = coopRiskPool.riskPool.reduce((acc, entry) => acc + entry.risk, 0);
    return coopRiskPool.getRisk();
}

export function calculateCoopRiskPoolRunScopedMutualInsuranceAuditHashes(
    riskPools: M29CoopRiskPoolRunScopedMutualInsurance[],
    runId: string,
): string[] {
    const coopRiskPool = new M29CoopRiskPoolRunScopedMutualInsurance();
    coopRiskPool.init(runId);
    for (const riskPool of riskPools) {
        if (riskPool.runId === runId) {
            coopRiskPool.riskPool.push(...riskPool.riskPool);
        }
    }

    return coopRiskPool.getAuditHashes();
}
