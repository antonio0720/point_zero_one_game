import { Injectable } from '@nestjs/common';
import { PaymentEntity } from './entities/payment.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EntitlementService } from '../entitlements/entitlements.service';

@Injectable()
export class PaymentsService {
constructor(
@InjectRepository(PaymentEntity)
private readonly paymentRepository: Repository<PaymentEntity>,
private readonly entitlementService: EntitlementService,
) {}

async createPayment(userId: number, amount: number): Promise<PaymentEntity> {
const userEntitlement = await this.entitlementService.getUserEntitlement(userId);

if (userEntitlement.balance < amount) {
throw new Error('Insufficient balance');
}

const payment = this.paymentRepository.create({
userId,
amount,
});

await this.entitlementService.debitUserEntitlement(userId, amount);
return this.paymentRepository.save(payment);
}
}
