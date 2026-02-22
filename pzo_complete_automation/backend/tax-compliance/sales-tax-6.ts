type Item = {
price: number;
};

function calculateSalesTax(items: Item[]): number {
let totalTax = 0;
items.forEach((item) => {
const itemWithTax = item.price * 1.06; // Adding sales tax (6%) to the price
totalTax += itemWithTax;
});
return totalTax;
}
