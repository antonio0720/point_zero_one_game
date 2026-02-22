import { AssetClass, LiabilityClass } from './asset_and_liability_classes';
import { LoanPortfolio, BondPortfolio } from './portfolio_classes';
import { ExpectedLossRate, ExposureAtDefault, DiscountFactor } from './risk_parameters';
import { TimePeriod } from './time_period';

interface GovernanceKernelInput {
loanPortfolios: LoanPortfolio[];
bondPortfolios: BondPortfolio[];
expectedLossRate: ExpectedLossRate;
exposureAtDefault: ExposureAtDefault;
discountFactor: DiscountFactor;
}

class GovernanceKernel {
constructor(private input: GovernanceKernelInput) {}

calculateCECL() {
const { loanPortfolios, bondPortfolios, expectedLossRate, exposureAtDefault, discountFactor } = this.input;

let totalCECL = 0;

for (const loanPortfolio of loanPortfolios) {
totalCECL += loanPortfolio.assets.reduce((sum, asset) => sum + this.calculateCECLForAsset(asset), 0);
}

for (const bondPortfolio of bondPortfolios) {
totalCECL += bondPortfolio.assets.reduce((sum, asset) => sum + this.calculateCECLForAsset(asset), 0);
}

return totalCECL * discountFactor;
}

private calculateCECLForAsset(asset: AssetClass | LiabilityClass): number {
const exposureAtDefaultValue = asset.exposureAtDefault;
const expectedLossRateValue = asset.expectedLossRate;

return exposureAtDefaultValue * expectedLossRateValue;
}
}

class AssetClass {
constructor(
public name: string,
public type: 'loan' | 'bond',
public exposureAtDefault: ExposureAtDefault,
public expectedLossRate: ExpectedLossRate,
) {}
}

class LiabilityClass {
constructor(
public name: string,
public type: 'loan' | 'bond',
public exposureAtDefault: ExposureAtDefault,
public expectedLossRate: ExpectedLossRate,
) {}
}

class LoanPortfolio {
constructor(public assets: AssetClass[]) {}
}

class BondPortfolio {
constructor(public assets: LiabilityClass[]) {}
}

interface ExpectedLossRate {
value: number;
timePeriod?: TimePeriod;
}

interface ExposureAtDefault {
value: number;
timePeriod?: TimePeriod;
}

interface DiscountFactor {
value: number;
timePeriod?: TimePeriod;
}

enum TimePeriod {
Year = 'Year',
Quarter = 'Quarter',
Month = 'Month',
Day = 'Day'
}
