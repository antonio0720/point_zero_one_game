interface Product {
name: string;
price: number;
}

interface Address {
country: string;
region?: string; // for countries with multiple tax regions, like Canada or EU
}

enum TaxType {
VAT = "VAT",
GST = "GST"
}

interface Receipt {
id: string;
date: Date;
products: Product[];
subtotal: number;
total: number;
taxAmount: number;
taxType: TaxType;
address: Address;
}

function calculateTax(subtotal: number, taxRate: number, taxType: TaxType) {
return subtotal * (taxRate / 100);
}

function generateReceipt(products: Product[], address: Address): Receipt {
const subtotal = products.reduce((acc, product) => acc + product.price, 0);
let taxAmount = 0;
let total = 0;

if (address.country === "UK") {
taxType = TaxType.VAT;
taxAmount = calculateTax(subtotal, 20, taxType);
} else if (address.region && address.region === "BC") {
taxType = TaxType.GST;
taxAmount = calculateTax(subtotal, 5, taxType);
} else { // Assuming no tax for other regions by default
taxAmount = 0;
}

total = subtotal + taxAmount;

return {
id: crypto.randomUUID(),
date: new Date(),
products,
subtotal,
total,
taxAmount,
taxType,
address
};
}
