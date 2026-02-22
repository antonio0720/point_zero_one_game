type CpiData = {
yearMonth: string;
cpi: number;
};

function calculateInflationRate(baseYearMonth: string, comparisonYearMonth: string, cpiData: CpiData[]): number {
const baseCpi = findCpiByYearMonth(cpiData, baseYearMonth);
const comparisonCpi = findCpiByYearMonth(cpiData, comparisonYearMonth);

if (isNaN(baseCpi) || isNaN(comparisonCpi)) {
throw new Error(`Invalid year month: ${baseYearMonth} or ${comparisonYearMonth}`);
}

const inflationRate = (comparisonCpi / baseCpi - 1) * 100;

return inflationRate;
}

function findCpiByYearMonth(cpiData: CpiData[], yearMonth: string): number {
return cpiData.find((data) => data.yearMonth === yearMonth)?.cpi || 0;
}
