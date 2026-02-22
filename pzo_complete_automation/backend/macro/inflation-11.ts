class InflationRateCalculator {
private cpiData: number[][];

constructor(cpiData: number[][]) {
this.cpiData = cpiData;
}

calculateAverageInflationRate(): number {
if (this.cpiData.length < 2) {
throw new Error("Not enough data to calculate inflation rate");
}

const numYears = this.cpiData.length - 1;
let inflationRateSum = 0;

for (let i = 1; i < numYears; i++) {
const currentYearCPI = this.cpiData[i];
const previousYearCPI = this.cpiData[i - 1];
const inflationRate = calculateAPCRate(currentYearCPI, previousYearCPI);
inflationRateSum += inflationRate;
}

const averageInflationRate = inflationRateSum / numYears;
return averageInflationRate;
}
}

function calculateAPCRate(currentYearData: number[], previousYearData: number[]): number {
const currentYearTotalCPI = currentYearData.reduce((a, b) => a + b, 0);
const previousYearTotalCPI = previousYearData.reduce((a, b) => a + b, 0);
const inflationRate = (currentYearTotalCPI - previousYearTotalCPI) / previousYearTotalCPI * 100;
return inflationRate;
}
