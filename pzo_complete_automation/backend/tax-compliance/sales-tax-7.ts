interface Product {
name: string;
price: number;
taxable: boolean;
}

type Location = 'NY' | 'CA';

function calculateSalesTax(location: Location, products: Product[]): number {
const rateMap: Record<Location, Record<string, number>> = {
NY: {
food: 0.05,
books: 0.04,
medicine: 0.04,
},
CA: {
food: 0.0775,
books: 0.08,
medicine: 0.0725,
},
};

let totalTax = 0;
const nexusThreshold = 100_000;

for (const product of products) {
if (!product.taxable) continue;

const rate = rateMap[location][product.name] || 0; // use default tax rate if not found
totalTax += product.price * rate;
}

// Exemptions: Sales tax does not apply for purchases under $100,000 in a state
if (products.reduce((sum, product) => sum + product.price, 0) < nexusThreshold) {
return 0;
}

return totalTax;
}
