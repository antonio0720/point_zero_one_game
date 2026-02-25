/**
 * Public Audit Ledger Service
 */

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

/**
 * AuditEntry entity
 */
export class AuditEntry {
  id: number;
  game_id: number;
  timestamp: Date;
  action: string;
  data: any; // Temporarily allow 'any' for game engine or replay data
}

/**
 * PublicAuditLedgerRepository interface
 */
export interface PublicAuditLedgerRepository {
  create(auditEntry: AuditEntry): Promise<AuditEntry>;
  findAll(): Promise<AuditEntry[]>;
}

/**
 * PublicAuditLedgerService class
 */
@Injectable()
export class PublicAuditLedgerService {
  constructor(
    @InjectRepository(AuditEntry)
    private readonly publicAuditLedgerRepository: Repository<AuditEntry>,
  ) {}

  async create(auditEntry: AuditEntry): Promise<AuditEntry> {
    return this.publicAuditLedgerRepository.save(auditEntry);
  }

  async findAll(): Promise<AuditEntry[]> {
    return this.publicAuditLedgerRepository.find();
  }
}

/**
 * AuditEntry table SQL creation
 */
const auditEntryTable = `
