export function calculateVat(netPrice: number, vatRate: number): number {
return netPrice * (vatRate / 100);
}

// Usage example
const netPrice = 100;
const vatRate = 20;
const vatAmount = calculateVat(netPrice, vatRate);
console.log(`VAT amount: ${vatAmount}`);
