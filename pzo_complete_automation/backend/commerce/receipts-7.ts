import { Injectable } from '@nestjs/common';
import { Mapper } from 'automapper-ts';
import { IEntitlement, ReceiptDto, ReceiptEntity } from './interfaces';
import { EntitlementService } from './entitlements.service';

@Injectable()
export class ReceiptsService {
constructor(private readonly entitlementService: EntitlementService) {}

async generateReceipt(userId: number): Promise<ReceiptDto> {
const userEntitlements = await this.entitlementService.getUserEntitlements(userId);

if (!userEntitlements || !userEntitlements.length) {
throw new Error('No entitlements found for the user');
}

const receiptEntity = this.mapper.map(userEntitlements[0], ReceiptEntity);

// Calculate total price based on entitlements
receiptEntity.totalPrice = userEntitlements.reduce((acc, entitlement: IEntitlement) => acc + entitlement.price, 0);

return this.mapper.map(receiptEntity, ReceiptDto);
}

private get mapper() {
return Mapper.createMapWithStrategies([
{ from: IEntitlement, to: ReceiptEntity },
{ from: ReceiptEntity, to: ReceiptDto },
]);
}
}
