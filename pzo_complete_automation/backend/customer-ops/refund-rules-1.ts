import { Injectable } from '@nestjs/common';
import { Repository } from 'typeorm';
import { InjectionToken } from '@nestjs/common';
import { RefundRule, Order, Product, Customer } from './entities';

const REFUND_RULES_REPOSITORY = new InjectionToken<Repository<RefundRule>>('REFUND_RULES_REPOSITORY');
const ORDER_REPOSITORY = new InjectionToken<Repository<Order>>('ORDER_REPOSITORY');
const PRODUCT_REPOSITORY = new InjectionToken<Repository<Product>>('PRODUCT_REPOSITORY');
const CUSTOMER_REPOSITORY = new InjectionToken<Repository<Customer>>('CUSTOMER_REPOSITORY');

@Injectable()
export class RefundRulesService {
constructor(
private readonly refundRulesRepository: Repository<RefundRule>,
@Inject(ORDER_REPOSITORY)
private readonly orderRepository: Repository<Order>,
@Inject(PRODUCT_REPOSITORY)
private readonly productRepository: Repository<Product>,
@Inject(CUSTOMER_REPOSITORY)
private readonly customerRepository: Repository<Customer>,
) {}

async findRules(): Promise<RefundRule[]> {
return this.refundRulesRepository.find();
}

async refundOrder(orderId: number): Promise<void> {
const order = await this.orderRepository.findOne(orderId, { relations: ['products', 'customer'] });

if (!order) {
throw new Error('Order not found');
}

const rules = await this.findRules();

for (const rule of rules) {
if (rule.appliesToOrder(order)) {
await this.applyRule(rule, order);
break;
}
}
}

private async applyRule(rule: RefundRule, order: Order): Promise<void> {
const totalRefundedAmount = rule.calculateRefund(order);

if (totalRefundedAmount > 0) {
await this.orderRepository.update(order.id, {
totalRefunded: order.totalRefunded + totalRefundedAmount,
status: 'refunded',
});

for (const product of order.products) {
const productQuantity = rule.calculateProductQuantityToRefund(product);

if (productQuantity > 0) {
await this.productRepository.update(product.id, { quantity: product.quantity - productQuantity });
}
}

const customer = await this.customerRepository.findOne(order.customerId);

if (customer) {
await this.customerRepository.update(customer.id, { refundsCount: customer.refundsCount + 1 });
}
}
}
}
