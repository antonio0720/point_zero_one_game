Here is a simplified TypeScript example for a VAT-5 calculation based on the provided information. Please note that this is a basic implementation and may not cover all edge cases or specific requirements of your project.

```typescript
interface Item {
description: string;
vatRate: number;
quantity: number;
priceExcludingVAT: number;
}

function calculateTotalVAT(items: Item[]): number {
return items.reduce((total, item) => total + item.quantity * item.priceExcludingVAT * (item.vatRate / 100), 0);
}

function calculateSubtotalWithoutVAT(items: Item[]): number {
return items.reduce((total, item) => total + item.quantity * item.priceExcludingVAT, 0);
}

function calculateTotalIncludingVAT(items: Item[], totalVat: number): number {
const subtotal = calculateSubtotalWithoutVAT(items);
return subtotal + totalVat;
}
```

This example defines an `Item` interface, which represents a taxable item with a description, VAT rate, quantity, and price excluding VAT. The functions `calculateTotalVAT`, `calculateSubtotalWithoutVAT`, and `calculateTotalIncludingVAT` perform the respective calculations.

You can use these functions in your application to calculate the total VAT, subtotal without VAT, and the total including VAT for a given list of items.
