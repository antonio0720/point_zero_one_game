import { Rule } from 'domain-events';
import { CustomerOrderEvent } from '../customer-order/events';

export class RefundRules6 implements Rule<CustomerOrderEvent> {
public matches(event: CustomerOrderEvent): boolean {
return event.type === 'OrderCancelled' && event.orderId === 6;
}

public execute(event: CustomerOrderEvent): void {
console.log(`Refunding order #${event.orderId} in full as per rule 6`);
}
}
