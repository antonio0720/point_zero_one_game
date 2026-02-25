/**
 * Cohort service implementation for Point Zero One Digital's financial roguelike game.
 */

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Cohort, SeasonWindow, FounderNight, MembershipReceipt } from './entities';

/**
 * Cohorts service for managing cohorts, season windows, founder nights, and membership receipts.
 */
@Injectable()
export class CohortsService {
  constructor(
    @InjectRepository(Cohort) private readonly cohortRepository: Repository<Cohort>,
    @InjectRepository(SeasonWindow) private readonly seasonWindowRepository: Repository<SeasonWindow>,
    @InjectRepository(FounderNight) private readonly founderNightRepository: Repository<FounderNight>,
    @InjectRepository(MembershipReceipt) private readonly membershipReceiptRepository: Repository<MembershipReceipt>,
  ) {}

  // CRUD operations for Cohort entity

  async createCohort(cohortData: Omit<Cohort, 'id'>): Promise<Cohort> {
    const cohort = this.cohortRepository.create(cohortData);
    return this.cohortRepository.save(cohort);
  }

  async findCohortById(id: number): Promise<Cohort | null> {
    return this.cohortRepository.findOneBy({ id });
  }

  async updateCohort(id: number, updates: Partial<Cohort>): Promise<Cohort | null> {
    const cohort = await this.findCohortById(id);
    if (cohort) {
      Object.assign(cohort, updates);
      return this.cohortRepository.save(cohort);
    }
    return null;
  }

  async deleteCohort(id: number): Promise<void> {
    const cohort = await this.findCohortById(id);
    if (cohort) {
      this.cohortRepository.remove(cohort);
    }
  }

  // Season window setup

  async createSeasonWindow(seasonWindowData: Omit<SeasonWindow, 'id'>): Promise<SeasonWindow> {
    const seasonWindow = this.seasonWindowRepository.create(seasonWindowData);
    return this.seasonWindowRepository.save(seasonWindow);
  }

  // Founder Night scheduling

  async createFounderNight(founderNightData: Omit<FounderNight, 'id'>): Promise<FounderNight> {
    const founderNight = this.founderNightRepository.create(founderNightData);
    return this.founderNightRepository.save(founderNight);
  }

  // Cohort membership receipts

  async createMembershipReceipt(receiptData: Omit<MembershipReceipt, 'id'>): Promise<MembershipReceipt> {
    const receipt = this.membershipReceiptRepository.create(receiptData);
    return this.membershipReceiptRepository.save(receipt);
  }
}

SQL:

-- Cohort table
