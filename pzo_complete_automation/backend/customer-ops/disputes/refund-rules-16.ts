import { DisputeReason, DisputeRule, RefundableItem } from '../interfaces';

const refundRules16: DisputeRule = {
id: 'RULE_16',
name: 'Refund Rule 16',
description: 'This rule handles specific scenarios where the refund amount is determined based on the product category and purchase price.',

apply: (items: RefundableItem[], disputeReason: DisputeReason) => {
const refundedItems: RefundableItem[] = [];
const totalAmountToRefund = 0;

// Define your custom logic here to determine the refund amount based on product categories, purchase prices and dispute reasons.

return { refundedItems, totalAmountToRefund };
},
};

export default refundRules16;
