import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Document } from 'mongoose';
import { Payment, PaymentDocument } from './schemas/payment.schema';
import { EntitlementService } from '../entitlements/entitlements.service';

interface PaymentCreateDto {
userId: string;
productId: string;
amount: number;
}

@Injectable()
export class PaymentsService {
constructor(
@InjectModel(Payment.name) private paymentModel: Model<PaymentDocument>,
private entitlementService: EntitlementService,
) {}

async create(data: PaymentCreateDto): Promise<Payment> {
const { userId, productId, amount } = data;

// Check if user has the necessary entitlement to purchase the product
const hasEntitlement = await this.entitlementService.checkEntitlement(userId, productId);
if (!hasEntitlement) {
throw new Error('User does not have required entitlement');
}

// Create a new payment record in the database
const payment = new this.paymentModel({
userId,
productId,
amount,
});

return await payment.save();
}
}
