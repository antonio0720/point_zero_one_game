Here is a simple TypeScript example for calculating VAT (Value Added Tax) based on the provided invoice data. This example assumes an invoice has properties `netAmount` and `vatRate`.

```typescript
interface Invoice {
netAmount: number;
vatRate: number;
}

function calculateVAT(invoiceData: Invoice): { netAmount: number, vatAmount: number } {
const { netAmount, vatRate } = invoiceData;
const vatAmount = netAmount * (vatRate / 100);
return { netAmount, vatAmount };
}

const invoiceData: Invoice = {
netAmount: 1000,
vatRate: 20,
};

console.log(calculateVAT(invoiceData));
```

This code defines an interface for an invoice, a function to calculate VAT based on the provided invoice data, and sample usage of that function with a specific invoice data.
