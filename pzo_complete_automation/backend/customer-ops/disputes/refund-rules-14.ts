import { DisputeRefundRule } from './dispute-refund-rule';
import { Order } from '../orders/order.model';

export class RefundRules14 extends DisputeRefundRule {
constructor() {
super('Refund Rules 14');
}

async evaluate(order: Order): Promise<boolean> {
const orderDate = order.createdAt;
const currentDate = new Date();
const dateDifference = Math.ceil((currentDate.getTime() - orderDate.getTime()) / (1000 * 60 * 60 * 24)); // in days

if (dateDifference >= 30) {
return true;
}

const refundedOrders = await this.refundService.getRefundedOrders(order.id);

if (refundedOrders.length > 2) {
return true;
}

return false;
}
}
