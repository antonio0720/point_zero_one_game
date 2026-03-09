/**
 * Cosmetic Store Service — PostgreSQL via TypeORM.
 * Replaces mongoose store_service.ts
 */

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CosmeticStoreItem } from '../../entities/cosmetic_store_item.entity';

export interface PurchaseResponse {
  success: boolean;
  message?: string;
  item?: CosmeticStoreItem;
}

@Injectable()
export class StoreService {
  constructor(
    @InjectRepository(CosmeticStoreItem)
    private readonly repo: Repository<CosmeticStoreItem>,
  ) {}

  async getItems(): Promise<CosmeticStoreItem[]> {
    return this.repo.find({ where: { isActive: true } });
  }

  async getItemById(id: string): Promise<CosmeticStoreItem | null> {
    return this.repo.findOneBy({ id, isActive: true });
  }

  async purchase(itemId: string, _userId: string): Promise<PurchaseResponse> {
    const item = await this.repo.findOneBy({ id: itemId, isActive: true });

    if (!item) {
      return { success: false, message: 'Item not found' };
    }

    // Debit player balance and add to inventory via separate
    // transaction in the caller — this service only validates the item.
    return { success: true, item };
  }
}
