interface VATInvoice {
id: string;
vendorId: string;
customerId: string;
invoiceDate: Date;
dueDate: Date;
totalAmount: number;
vatRate: number;
vatAmount: number;
}

function validateVATInvoice(invoice: VATInvoice): boolean {
const today = new Date();
const minDueDate = new Date(today.getFullYear(), today.getMonth() + 1, today.getDate());

return (
invoice.vatRate >= 0 &&
invoice.vatRate <= 1 &&
invoice.dueDate >= invoice.invoiceDate &&
minDueDate <= invoice.dueDate &&
invoice.totalAmount > 0 &&
invoice.vatAmount === (invoice.totalAmount * invoice.vatRate) / 100
);
}
