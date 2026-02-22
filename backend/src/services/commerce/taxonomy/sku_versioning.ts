/**
 * Service for managing SKU versioning and audit receipts for tag changes.
 */

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, EntitySubscription } from 'typeorm';

/**
 * SKU Version entity.
 */
@Entity('sku_versions')
export class SkuVersion {
  /**
   * Unique identifier for the SKU version.
   */
  @PrimaryGeneratedColumn()
  id: number;

  /**
   * The unique identifier of the associated SKU.
   */
  @Column({ type: 'uuid' })
  skuId: string;

  /**
   * The version number for this SKU.
   */
  @Column()
  version: number;

  /**
   * The timestamp when the version was created.
   */
  @Column({ type: 'timestamp' })
  createdAt: Date;

  /**
   * The timestamp when the version was last updated.
   */
  @Column({ type: 'timestamp', onUpdate: true })
  updatedAt: Date;

  /**
   * An array of audit receipts for tag changes in this SKU version.
   */
  @OneToMany(() => AuditReceipt, (auditReceipt) => auditReceipt.skuVersion)
  auditReceipts: AuditReceipt[];
}

/**
 * Audit receipt entity for tag changes in SKU versions.
 */
@Entity('audit_receipts')
export class AuditReceipt {
  /**
   * Unique identifier for the audit receipt.
   */
  @PrimaryGeneratedColumn()
  id: number;

  /**
   * The unique identifier of the associated SKU version.
   */
  @Column({ type: 'uuid', onDelete: 'CASCADE' })
  skuVersionId: string;

  /**
   * The name of the tag that was changed.
   */
  @Column()
  tagName: string;

  /**
   * The old value of the tag before the change.
   */
  @Column()
  oldValue: string;

  /**
   * The new value of the tag after the change.
   */
  @Column()
  newValue: string;

  /**
   * The timestamp when the tag change occurred.
   */
  @Column({ type: 'timestamp' })
  changedAt: Date;
}

/**
 * SKU Versioning Service.
 */
@Injectable()
export class SkuVersioningService {
  constructor(
    @InjectRepository(SkuVersion) private skuVersionRepository: Repository<SkuVersion>,
    @InjectRepository(AuditReceipt) private auditReceiptRepository: Repository<AuditReceipt>
  ) {}

  /**
   * Create a new version of an SKU and attach an audit receipt for any tag changes.
   * @param skuId - The unique identifier of the SKU to version.
   * @param tags - An object mapping tag names to their new values.
   */
  async createVersion(skuId: string, tags: Record<string, string>): Promise<SkuVersion> {
    const skuVersion = await this.skuVersionRepository.create({ skuId, version: 1, createdAt: new Date() });
    await this.skuVersionRepository.save(skuVersion);

    for (const [tagName, tagValue] of Object.entries(tags)) {
      const auditReceipt = await this.auditReceiptRepository.create({ skuVersionId: skuVersion.id, tagName, oldValue: '', newValue: tagValue, changedAt: new Date() });
      await this.auditReceiptRepository.save(auditReceipt);
    }

    return skuVersion;
  }
}
