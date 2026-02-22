type Product = {
name: string;
price: number;
taxRate?: number; // if product has its own tax rate
}

function getBasePrice(product: Product) {
return product.price * (1 - (product.taxRate || 0.07)); // default tax rate is 7% for most states
}

function calculateSalesTax(subtotal: number, stateAbbreviation: string) {
const basePrice = subtotal;

let stateTaxRate = 0;

switch (stateAbbreviation.toLowerCase()) {
case 'ct':
case 'de':
case 'fl':
case 'ga':
case 'md':
case 'ma':
case 'me':
case 'mi':
case 'nj':
case 'ny':
case 'nm':
case 'nc':
case 'oh':
case 'pa':
case 'ri':
case 'sc':
case 'tx':
case 'va':
case 'wa':
case 'wi':
stateTaxRate = 0.06; // 6% sales tax rate for most states
break;

case 'il':
stateTaxRate = 0.08; // Illinois has a higher sales tax rate of 8%
break;

case 'dc': // District of Columbia
stateTaxRate = 0.0575; // DC has a lower combined sales and use tax rate of 5.75%
break;

default:
throw new Error(`Unsupported state: ${stateAbbreviation}`);
}

return basePrice * stateTaxRate;
}
