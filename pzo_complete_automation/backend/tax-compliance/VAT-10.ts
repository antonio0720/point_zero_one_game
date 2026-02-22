```typescript
export interface Invoice {
netTotal: number;
vatRate: number;
}

const calculateVat10 = (invoice: Invoice): Invoice => {
const { netTotal, vatRate } = invoice;
const vatAmount = netTotal * (vatRate / 100);
const grossTotal = netTotal + vatAmount;

return {
netTotal,
vatRate,
vatAmount,
grossTotal,
};
};
```

This code defines an `Invoice` interface that represents a tax invoice with properties for the net total and VAT rate. Then, it provides a function `calculateVat10` to calculate the VAT amount based on the provided net total and VAT rate using the VAT-10 rule (adds 10% VAT to the net total). The function returns an object that includes the original net total, VAT rate, VAT amount, and gross total.
