function generateReceipt(params: Omit<Receipt, 'id'> & { taxRate?: number; isTaxInclusive?: boolean }) {
const receipt = new Receipt(params);

let totalAmountWithTax = 0;
if (receipt.isTaxInclusive) {
// If the receipt is tax-inclusive, calculate the tax and add it to the total amount.
totalAmountWithTax = params.items.reduce(
(acc, item) => acc + item.price * item.quantity,
0
) * (1 + (receipt.taxRate || 0));
} else {
// If the receipt is not tax-inclusive, calculate the total amount and add tax separately.
totalAmountWithTax = params.items.reduce(
(acc, item) => acc + item.price * item.quantity,
0
);
totalAmountWithTax *= 1 + (receipt.taxRate || 0);
}

receipt.totalAmount = totalAmountWithTax;
return receipt;
}
