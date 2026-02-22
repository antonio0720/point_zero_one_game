{ rate: 0.06, destinationState: 'NY' },
{ rate: 0.07, destinationState: 'CA' },
// ...
];

function calculateSalesTax(sellingState: string, destinationState: string, price: number): number {
const taxRate = TAX_RATES.find((rate) => rate.destinationState === destinationState);

if (!taxRate) {
throw new Error(`No tax rate found for destination state ${destinationState}`);
}

return price * taxRate.rate;
}
```

You can expand the `TAX_RATES` array to include tax rates for other states as needed.
