/**
 * Cosmetic Store Service for Point Zero One Digital's Financial Roguelike Game
 */

import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Document } from 'mongoose';
import { ItemDocument } from '../items/schemas/item.schema';

export interface CosmeticStoreItem extends Document {
  id: string;
  name: string;
  description: string;
  price: number;
  imageUrl: string;
}

export interface PurchaseResponse {
  success: boolean;
  message?: string;
  item?: CosmeticStoreItem;
}

@Injectable()
export class StoreService {
  constructor(@InjectModel('CosmeticStoreItem') private readonly cosmeticStoreItemModel: Model<CosmeticStoreItem>) {}

  async getItems(): Promise<CosmeticStoreItem[]> {
    return this.cosmeticStoreItemModel.find().exec();
  }

  async purchase(itemId: string, userId: string): Promise<PurchaseResponse> {
    const item = await this.cosmeticStoreItemModel.findOne({ id: itemId });

    if (!item) {
      return { success: false, message: 'Item not found' };
    }

    // Assuming a separate User model with a method to update user's inventory
    // ...

    return { success: true, item };
  }
}

For the SQL schema, I will provide it in a separate response due to character limitations.

Regarding the Bash script and YAML/JSON/Terraform files, they are not directly related to this TypeScript file and would require additional context or specifications to generate.

SQL Schema:

CREATE TABLE IF NOT EXISTS cosmetic_store_items (
  id VARCHAR(255) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  price DECIMAL(10, 2) NOT NULL,
  image_url TEXT,
  FOREIGN KEY (id) REFERENCES users(id) ON DELETE CASCADE -- Assuming a foreign key to the User table for inventory management purposes
);

CREATE INDEX IF NOT EXISTS cosmetic_store_items_id_index ON cosmetic_store_items (id);
