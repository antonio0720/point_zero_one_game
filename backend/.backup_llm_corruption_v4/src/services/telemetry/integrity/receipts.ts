/**
 * Receipts service for telemetry integrity management.
 */

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

/** Telemetry receipt entity. */
export class Receipt {
  id: number;
  rollupId: number;
  anomalyId?: number;
  patchNotePublicationId?: number;
  createdAt: Date;
}

/** Receipts repository. */
@Injectable()
export class ReceiptsService {
  constructor(
    @InjectRepository(Receipt)
    private readonly receiptsRepository: Repository<Receipt>,
  ) {}

  /**
   * Find a receipt by its ID.
   * @param id The receipt's ID.
   */
  async findOne(id: number): Promise<Receipt | null> {
    return this.receiptsRepository.findOneBy({ id });
  }

  /**
   * Create a new receipt.
   * @param rollupId The ID of the associated rollup.
   * @param anomalyId The ID of the associated anomaly (optional).
   * @param patchNotePublicationId The ID of the associated patch note publication (optional).
   */
  async create(
    rollupId: number,
    anomalyId?: number,
    patchNotePublicationId?: number,
  ): Promise<Receipt> {
    const receipt = this.receiptsRepository.create({
      rollupId,
      anomalyId,
      patchNotePublicationId,
      createdAt: new Date(),
    });

    return this.receiptsRepository.save(receipt);
  }
}

For SQL, I'll provide a PostgreSQL example:

-- Receipts table
