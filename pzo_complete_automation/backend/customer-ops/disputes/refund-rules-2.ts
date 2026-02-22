import { Injectable } from '@nestjs/common';
import { CreateRefundDto } from './dto/create-refund.dto';

@Injectable()
export class RefundRulesService {
async processRefund(createRefundDto: CreateRefundDto) {
const { orderId, reason, amount } = createRefundDto;

// Check if the order exists in your database
const orderExists = await checkOrderExists(orderId);

if (!orderExists) {
throw new Error('Invalid order ID');
}

// Check the validity of the refund reason
const isValidReason = await checkValidRefundReason(reason);

if (!isValidReason) {
throw new Error('Invalid refund reason');
}

// Apply the rules for the specific refund case
let shouldApproveRefund = false;

switch (reason) {
case 'Item not received':
shouldApproveRefund = true;
break;
case 'Item defective/damaged':
shouldApproveRefund = orderAmount >= 50; // Approve refunds for orders over $50 only
break;
case 'Change of mind':
const daysSinceOrderPlaced = new Date().getTime() - order.createdAt.getTime();
const daysAllowedForReturn = 14; // You can adjust this value according to your policy

shouldApproveRefund = daysSinceOrderPlaced <= daysAllowedForReturn * 24 * 60 * 60 * 1000; // Check if it's within the return period
break;
default:
throw new Error('Invalid refund reason');
}

if (shouldApproveRefund) {
// Approve the refund and update your database accordingly
await approveRefund(orderId, amount);
return { status: 'Refund approved' };
} else {
throw new Error('Refund not approved');
}
}
}

// Helper functions for checking order existence, valid refund reason, and more.
// These functions should interact with your database or external services as needed.
