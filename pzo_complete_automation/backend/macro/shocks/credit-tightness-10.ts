export interface CreditTightnessData {
countryCode: string;
year: number;
creditTightnessIndex: number;
}

export function creditTightnessImpact(data: CreditTightnessData[], interestRate: number): number {
const tighteningFactor = 0.1;
const dataGroupedByCountry = groupBy(data, 'countryCode');

let impact = 0;

Object.keys(dataGroupedByCountry).forEach((countryCode) => {
const countryData = dataGroupedByCountry[countryCode];
const lastYearCreditTightness = countryData[countryData.length - 1].creditTightnessIndex;

impact += (lastYearCreditTightness * tighteningFactor) * countryData.length;
});

return impact * interestRate;
}

function groupBy<T>(list: T[], property: keyof T): { [key: string]: T[] } {
const map: { [key: string]: T[] } = {};
list.forEach((item) => {
const propertyValue = item[property];
if (!map[propertyValue]) {
map[propertyValue] = [];
}
map[propertyValue].push(item);
});
return map;
}
