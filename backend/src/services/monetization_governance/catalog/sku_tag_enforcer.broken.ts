/**
 * SKU Tag Enforcer Service
 */

import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Document } from 'mongoose';
import { SKUTagDocument } from './sku_tag.model';
import { CreateSkuDto } from '../dto/create-sku.dto';

export interface SKUTag {
  tag: string;
}

export type SKUTagDocument = SKUTag & Document;

@Injectable()
export class SkuTagEnforcerService {
  constructor(
    @InjectModel('SKUTag') private skuTagModel: Model<SKUTagDocument>,
  ) {}

  async enforceTags(createSkuDto: CreateSkuDto): Promise<void> {
    const { tags } = createSkuDto;

    // Check if SKU has any tags
    if (!tags || tags.length === 0) {
      throw new Error('SKU must have at least one tag to be published.');
    }

    // Fetch all existing SKU tags
    const existingTags = await this.skuTagModel.find({}).exec();

    // Check if each tag of the SKU exists in the database
    for (const tag of tags) {
      const foundTag = existingTags.some(
        (existingTag: SKUTagDocument) => existingTag.tag === tag,
      );

      if (!foundTag) {
        throw new Error(`Tag "${tag}" does not exist in the database.`);
      }
    }
  }
}
