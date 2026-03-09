/**
 * Service for managing SKU versioning and audit receipts for tag changes.
 */

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Entity, PrimaryGeneratedColumn, Column, OneToMany, ManyToOne, JoinColumn } from 'typeorm';

@Entity('sku_versions')
export class SkuVersion {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'uuid', name: 'sku_id' })
  skuId: string;

  @Column()
  version: number;

  @Column({ type: 'timestamp', name: 'created_at' })
  createdAt: Date;

  @Column({ type: 'timestamp', name: 'updated_at' })
  updatedAt: Date;

  @OneToMany(() => AuditReceipt, (receipt) => receipt.skuVersion)
  auditReceipts: AuditReceipt[];
}

@Entity('audit_receipts')
export class AuditReceipt {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'sku_version_id' })
  skuVersionId: number;

  @ManyToOne(() => SkuVersion, (sv) => sv.auditReceipts, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'sku_version_id' })
  skuVersion: SkuVersion;

  @Column({ name: 'tag_name' })
  tagName: string;

  @Column({ name: 'old_value' })
  oldValue: string;

  @Column({ name: 'new_value' })
  newValue: string;

  @Column({ type: 'timestamp', name: 'changed_at' })
  changedAt: Date;
}

@Injectable()
export class SkuVersioningService {
  constructor(
    @InjectRepository(SkuVersion) private readonly skuVersionRepo: Repository<SkuVersion>,
    @InjectRepository(AuditReceipt) private readonly auditReceiptRepo: Repository<AuditReceipt>,
  ) {}

  async createVersion(skuId: string, tags: Record<string, string>): Promise<SkuVersion> {
    const skuVersion = this.skuVersionRepo.create({ skuId, version: 1, createdAt: new Date(), updatedAt: new Date() });
    await this.skuVersionRepo.save(skuVersion);

    for (const [tagName, tagValue] of Object.entries(tags)) {
      const receipt = this.auditReceiptRepo.create({
        skuVersionId: skuVersion.id, tagName, oldValue: '', newValue: tagValue, changedAt: new Date(),
      });
      await this.auditReceiptRepo.save(receipt);
    }

    return skuVersion;
  }
}
