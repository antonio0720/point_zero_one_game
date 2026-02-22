import { RefundRuleInterface } from '../interfaces/refund-rule.interface';

export class RefundRule4 implements RefundRuleInterface {
ruleId: number = 4;

execute(order: Order, reason: string): boolean {
if (reason === 'Item Not Received') {
// Check if the order status is delivered or not
if (order.status !== 'Delivered') {
return true;
}
}

return false;
}
}
