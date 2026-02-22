'If the total amount of an order exceeds the specified threshold, this rule will offer a 12% discount on the entire order as a refund.',
conditions: [
{
key: 'total_amount',
operator: '>',
value: 500,
},
],
actions: [
{
key: 'refund_percentage',
amount: -0.12, // Offer a 12% discount as a refund
},
],
};

export default refundRules12;
```
