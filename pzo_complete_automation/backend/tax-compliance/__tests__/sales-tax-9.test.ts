import { calculateSalesTax } from '../src/tax-compliance';
import { expect } from 'chai';

describe('Sales Tax - Compliance Automation - Sales Tax 9', () => {
it('should compute sales tax correctly for case 9', () => {
const itemList = [
{ name: 'book', price: 12.48, taxRate: 0.05 },
{ name: 'music CD', price: 14.99, taxRate: 0.15 },
{ name: 'chocolate bar', price: 0.85, taxRate: 0.1 },
];

const expectedTotalPrice = 60.57;
const totalTax = 9.72;
const totalWithTax = expectedTotalPrice + totalTax;

const result = calculateSalesTax(itemList);

expect(result.totalPrice).to.equalApprox(expectedTotalPrice, 0.01);
expect(result.totalTax).to.equalApprox(totalTax, 0.01);
expect(result.totalWithTax).to.equalApprox(totalWithTax, 0.01);
});
});
