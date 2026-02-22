export interface CpiData {
month: number;
cpi: number;
}

export class Inflation {
private basePeriodCpi: number;
private periods: CpiData[];

constructor(basePeriodCpi: number, periods: CpiData[]) {
this.basePeriodCpi = basePeriodCpi;
this.periods = periods;
}

public calculateAPR(): number {
const inflationFactor = this.calculateInflationFactor();
return (1 + inflationFactor) ** 12 - 1;
}

private calculateInflationFactor(): number {
if (this.periods.length < 2) {
throw new Error("Insufficient data to calculate APR.");
}

const latestCpi = this.getLatestCpi();
const basePeriodCpi = this.basePeriodCpi;

return Math.pow(latestCpi / basePeriodCpi, 1 / (this.periods.length - 1));
}

private getLatestCpi(): number {
return this.periods[this.periods.length - 1].cpi;
}
}
