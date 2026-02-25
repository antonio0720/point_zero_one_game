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
CREATE TABLE IF NOT EXISTS cohorts (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  FOREIGN KEY (id) REFERENCES season_windows(cohort_id) ON DELETE CASCADE,
  UNIQUE (name)
);

-- SeasonWindow table
CREATE TABLE IF NOT EXISTS season_windows (
  id SERIAL PRIMARY KEY,
  cohort_id INTEGER REFERENCES cohorts(id),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  UNIQUE (cohort_id, start_date)
);

-- FounderNight table
CREATE TABLE IF NOT EXISTS founder_nights (
  id SERIAL PRIMARY KEY,
  season_window_id INTEGER REFERENCES season_windows(id),
  date DATE NOT NULL,
  UNIQUE (season_window_id, date)
);

-- MembershipReceipt table
CREATE TABLE IF NOT EXISTS membership_receipts (
  id SERIAL PRIMARY KEY,
  cohort_id INTEGER REFERENCES cohorts(id),
  user_id INTEGER NOT NULL,
  amount DECIMAL(10, 2) NOT NULL,
  date DATE NOT NULL,
  FOREIGN KEY (cohort_id) REFERENCES cohorts(id),
  UNIQUE (cohort_id, user_id, date)
);

Bash:

#!/bin/sh
set -euo pipefail

echo "Creating database tables"
psql -f sql/schema.sql your_database_name

echo "Migrating TypeScript entities to the database"
npm run typeorm migration:run

Terraform (example):

provider "postgresql" {
  host     = var.host
  port     = var.port
  user     = var.user
  password = var.password
  database = var.database
}

resource "postgres_table" "cohorts" {
  name   = "cohorts"
  columns = [
    { name = "id"; type = "SERIAL PRIMARY KEY" },
    { name = "name"; type = "VARCHAR(255) NOT NULL" },
    { name = "start_date"; type = "DATE NOT NULL" },
    { name = "end_date"; type = "DATE NOT NULL" },
    { name = "cohort_id"; type = "INTEGER REFERENCES season_windows(id) ON DELETE CASCADE" },
    { name = "UNIQUE (name)" }
  ]
}

resource "postgres_table" "season_windows" {
  name   = "season_windows"
  columns = [
    { name = "id"; type = "SERIAL PRIMARY KEY" },
    { name = "cohort_id"; type = "INTEGER REFERENCES cohorts(id)" },
    { name = "start_date"; type = "DATE NOT NULL" },
    { name = "end_date"; type = "DATE NOT NULL" },
    { name = "UNIQUE (cohort_id, start_date)" }
  ]
}

resource "postgres_table" "founder_nights" {
  name   = "founder_nights"
  columns = [
    { name = "id"; type = "SERIAL PRIMARY KEY" },
    { name = "season_window_id"; type = "INTEGER REFERENCES season_windows(id)" },
    { name = "date"; type = "DATE NOT NULL" },
    { name = "UNIQUE (season_window_id, date)" }
  ]
}

resource "postgres_table" "membership_receipts" {
  name   = "membership_receipts"
  columns = [
    { name = "id"; type = "SERIAL PRIMARY KEY" },
    { name = "cohort_id"; type = "INTEGER REFERENCES cohorts(id)" },
    { name = "user_id"; type = "INTEGER NOT NULL" },
    { name = "amount"; type = "DECIMAL(10, 2) NOT NULL" },
    { name = "date"; type = "DATE NOT NULL" },
    { name = "FOREIGN KEY (cohort_id) REFERENCES cohorts(id)" },
    { name = "UNIQUE (cohort_id, user_id, date)" }
  ]
}
