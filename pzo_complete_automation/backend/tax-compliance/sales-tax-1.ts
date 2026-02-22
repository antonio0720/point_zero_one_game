class SalesTax {
private baseRate: number;

constructor(baseRate: number) {
this.baseRate = baseRate / 100;
}

calculateSalesTax(subtotal: number): number {
return subtotal * this.baseRate;
}
}

const salesTaxCalculator = new SalesTax(7); // 7% tax rate

// Example usage
console.log(salesTaxCalculator.calculateSalesTax(100)); // Output: 7
