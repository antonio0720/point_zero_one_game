const prices: Price[] = [
{ year: 2015, price: 100 },
{ year: 2016, price: 110 },
{ year: 2017, price: 120 },
// ... add more years and prices here
];

const inflationRates = calculateInflationRate(prices, 2015);
console.log(inflationRates);
