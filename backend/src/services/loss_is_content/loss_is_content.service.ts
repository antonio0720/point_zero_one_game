/**
 * Loss Is Content services — Postgres via TypeORM.
 * Replaces 5 mongoose files: autopsy, turning_point_locator,
 * cause_of_death, eligibility_lock, scenario_picker.
 */

import { Injectable } from '@nestjs/common';
import { InjectRepository, InjectDataSource } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import {
  AutopsySnippet, CauseOfDeath, EligibilityLock, TrainingScenario,
} from '../../entities/loss_is_content.entity';

// ── Autopsy Snippet Service ──────────────────────────────────────────

@Injectable()
export class AutopsySnippetService {
  constructor(
    @InjectRepository(AutopsySnippet) private readonly repo: Repository<AutopsySnippet>,
  ) {}

  async create(runId: string, snippet: string): Promise<AutopsySnippet> {
    return this.repo.save(this.repo.create({ runId, snippet }));
  }

  async findByRun(runId: string): Promise<AutopsySnippet[]> {
    return this.repo.find({ where: { runId }, order: { createdAt: 'ASC' } });
  }

  async findById(id: string): Promise<AutopsySnippet | null> {
    return this.repo.findOneBy({ id });
  }
}

// ── Turning Point Locator Service ────────────────────────────────────

@Injectable()
export class TurningPointLocatorService {
  constructor(@InjectDataSource() private readonly db: DataSource) {}

  /**
   * Locates turning point threshold crossing from game events
   * and derives a snippet window around it.
   */
  async findTurningPoint(runId: string, threshold: string): Promise<unknown[]> {
    const events = await this.db.query(
      `SELECT * FROM game_events
       WHERE run_id = $1
       ORDER BY turn_number ASC`,
      [runId],
    );

    // Find the first event where state crosses the threshold
    let crossingIdx = -1;
    for (let i = 1; i < events.length; i++) {
      if (events[i - 1].game_state !== threshold && events[i].game_state === threshold) {
        crossingIdx = i;
        break;
      }
    }

    if (crossingIdx < 0) return [];

    // Return a ±10 event window around the crossing
    const start = Math.max(0, crossingIdx - 10);
    const end = Math.min(events.length, crossingIdx + 11);
    return events.slice(start, end);
  }
}

// ── Cause of Death Service ───────────────────────────────────────────

@Injectable()
export class CauseOfDeathService {
  constructor(
    @InjectRepository(CauseOfDeath) private readonly repo: Repository<CauseOfDeath>,
  ) {}

  async create(name: string, description: string): Promise<CauseOfDeath> {
    return this.repo.save(this.repo.create({ name, description }));
  }

  async findById(id: string): Promise<CauseOfDeath | null> {
    return this.repo.findOneBy({ id });
  }

  async findByName(name: string): Promise<CauseOfDeath | null> {
    return this.repo.findOneBy({ name });
  }
}

// ── Eligibility Lock Service ─────────────────────────────────────────

@Injectable()
export class EligibilityLockService {
  constructor(
    @InjectRepository(EligibilityLock) private readonly repo: Repository<EligibilityLock>,
  ) {}

  async setPracticeMode(gameId: string, userId: string): Promise<void> {
    const existing = await this.repo.findOneBy({ gameId, userId });
    if (existing) {
      existing.practiceMode = true;
      await this.repo.save(existing);
    } else {
      await this.repo.save(this.repo.create({ gameId, userId, practiceMode: true }));
    }
  }

  async isInPracticeMode(gameId: string, userId: string): Promise<boolean> {
    const lock = await this.repo.findOneBy({ gameId, userId });
    return lock?.practiceMode ?? false;
  }
}

// ── Scenario Picker Service ──────────────────────────────────────────

@Injectable()
export class ScenarioPickerService {
  constructor(
    @InjectRepository(TrainingScenario) private readonly repo: Repository<TrainingScenario>,
  ) {}

  async pickScenario(stage: string): Promise<TrainingScenario | null> {
    return this.repo.findOne({
      where: { stage, shortLaunchable: true },
      order: { createdAt: 'DESC' },
    });
  }

  async findAll(): Promise<TrainingScenario[]> {
    return this.repo.find({ order: { stage: 'ASC', name: 'ASC' } });
  }
}
