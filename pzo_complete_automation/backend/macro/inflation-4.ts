interface PriceData {
currentPrice: number;
previousPrice: number;
}

function calculateInflation(priceData: PriceData): number {
const priceChange = priceData.currentPrice - priceData.previousPrice;
const inflationRate = (priceChange / priceData.previousPrice) * 100;
return inflationRate.toFixed(2);
}
