interface Item {
price: number;
taxRate: number;
}

function calculateSalesTax(items: Item[]): number {
return items.reduce((total, item) => total + (item.price * item.taxRate), 0);
}

const items: Item[] = [
{ price: 100, taxRate: 0.05 },
{ price: 200, taxRate: 0.08 },
// Add more items as needed
];

console.log(calculateSalesTax(items));
