```typescript
import { RefundRule, Order } from './interfaces';

const refundRules: RefundRule[] = [
{
name: 'Rule 1 - Item specific refund',
apply: (order: Order) => {
const itemToRefund = order.items.find(item => item.id === 'specific-item-id');
if (itemToRefund && itemToRefund.price > 50) {
return { amount: itemToRefund.price, reason: 'Item specific refund' };
}
return null;
},
},
// Add more rules as needed...
];

export { refundRules };
```

In the provided example, `RefundRule` and `Order` are interface types that you should define according to your requirements. The given rule checks for a specific item with an ID of 'specific-item-id' and refunds its full price if it costs more than 50. You can add more rules as needed within the `refundRules` array.

You can use this code in conjunction with another function that iterates over the `refundRules` array, applying each rule to an order, until a matching rule is found or all rules have been processed. The returned object (if any) represents the amount to refund and the reason for the refund.
