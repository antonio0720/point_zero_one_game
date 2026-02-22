import { RefundRule } from './refund-rule';
import { Product } from '../products/product';
import { Transaction } from '../transactions/transaction';

export class Rule9 extends RefundRule {
private static MATCHING_PRODUCT_IDS: number[] = [123, 456];
private static MIN_TRANSACTION_VALUE = 100;

public canRefund(transaction: Transaction): boolean {
const matchingProductIds = transaction.getProductIds();
return (
this.isMatchingProduct(matchingProductIds) &&
transaction.getValue() >= Rule9.MIN_TRANSACTION_VALUE
);
}

private isMatchingProduct(productIds: number[]): boolean {
return productIds.some((id) => Rule9.MATCHING_PRODUCT_IDS.includes(id));
}
}
