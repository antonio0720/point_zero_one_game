// pzo_engine/src/mechanics/m031.ts

export class M31SynergySets {
    private synergySets: { [key: string]: number[] };
    private mlEnabled: boolean;
    private auditHash: string;

    constructor() {
        this.synergySets = {};
        this.mlEnabled = false;
        this.auditHash = '';
    }

    public setSynergySet(themeName: string, synergySet: number[]): void {
        if (this.synergySets[themeName]) {
            throw new Error(`Theme ${themeName} already has a synergy set`);
        }
        this.synergySets[themeName] = synergySet;
    }

    public getSynergySet(themeName: string): number[] | undefined {
        return this.synergySets[themeName];
    }

    public calculateComboBonus(portfolioThemes: { [key: string]: number }): number {
        if (!this.mlEnabled) {
            throw new Error('ML is not enabled');
        }
        const synergySetBonuses = Object.keys(this.synergySets).map((themeName) => {
            const themeSynergySet = this.getSynergySet(themeName);
            if (themeSynergySet && portfolioThemes[themeName] >= 1) {
                return Math.min(...themeSynergySet.map((synergyValue, index) => synergyValue * (portfolioThemes[themeName] - index)));
            }
            return 0;
        });
        const totalBonus = synergySetBonuses.reduce((a, b) => a + b, 0);
        if (totalBonus > 1) {
            throw new Error('Combo bonus exceeds maximum allowed value');
        }
        return Math.min(totalBonus, 1);
    }

    public setMLEnabled(enabled: boolean): void {
        this.mlEnabled = enabled;
    }

    public getAuditHash(): string {
        const synergySetStrings = Object.keys(this.synergySets).map((themeName) => JSON.stringify(this.getSynergySet(themeName)));
        return crypto.createHash('sha256').update(JSON.stringify({ ...this.synergySets, mlEnabled: this.mlEnabled })).digest('hex');
    }
}
