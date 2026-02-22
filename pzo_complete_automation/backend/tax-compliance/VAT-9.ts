interface Invoice {
invoiceNumber: string;
vatRate: number; // as a decimal (e.g., 0.2 for 20%)
totalAmount: number;
invoiceDate: Date;
}

type Invoices = Invoice[];

function calculateVAT9(invoices: Invoices): number {
const VAT_THRESHOLD = 100000; // change as necessary
let vatAmount = 0;

for (const invoice of invoices) {
const vat = invoice.totalAmount * invoice.vatRate;
if (vat > VAT_THRESHOLD) {
vatAmount += VAT_THRESHOLD * invoice.vatRate;
} else {
vatAmount += vat;
}
}

return Math.round(vatAmount * 100) / 100;
}
