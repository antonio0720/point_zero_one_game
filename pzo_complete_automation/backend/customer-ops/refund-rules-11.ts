import { RefundRule } from './refund-rule';
import { Order, Product, Discount } from '../models';

class RefundRule11 extends RefundRule {
private MIN_SPENDING_THRESHOLD = 500;

apply(order: Order): void {
if (order.total < this.MIN_SPENDING_THRESHOLD) return;

const eligibleProducts: Product[] = [];
order.items.forEach((item) => {
if (item.product.category === 'Electronics' && item.quantity > 2) {
eligibleProducts.push(item.product);
}
});

const applicableDiscount: Discount = new Discount('Rule11', -0.1, 'Electronics Spending');
eligibleProducts.forEach((product) => {
product.discounts.push(applicableDiscount);
});
}
}
