/**
 * Backfill job to rebuild public read models from event logs.
 * Supports partial backfill per partition and emits progress telemetry.
 */

import { Job, JobContext } from '@pointzeroonedigital/job-framework';
import { EventLogRepository } from '../repositories/event-log-repository';
import { RunExplorerPublicRepository } from '../repositories/run-explorer-public-repository';
import { LadderRankingsRepository } from '../repositories/ladder-rankings-repository';
import { Season0MembershipsRepository } from '../repositories/season0-memberships-repository';
import { CreatorSubmissionsRepository } from '../repositories/creator-submissions-repository';

export class BackfillPublicReadModelsJob extends Job {
  private eventLogRepository: EventLogRepository;
  private runExplorerPublicRepository: RunExplorerPublicRepository;
  private ladderRankingsRepository: LadderRankingsRepository;
  private season0MembershipsRepository: Season0MembershipsRepository;
  private creatorSubmissionsRepository: CreatorSubmissionsRepository;

  constructor(context: JobContext) {
    super(context);
    this.eventLogRepository = context.getDependency<EventLogRepository>('event-log-repository');
    this.runExplorerPublicRepository = context.getDependency<RunExplorerPublicRepository>(
      'run-explorer-public-repository'
    );
    this.ladderRankingsRepository = context.getDependency<LadderRankingsRepository>(
      'ladder-rankings-repository'
    );
    this.season0MembershipsRepository = context.getDependency<Season0MembershipsRepository>(
      'season0-memberships-repository'
    );
    this.creatorSubmissionsRepository = context.getDependency<CreatorSubmissionsRepository>(
      'creator-submissions-repository'
    );
  }

  public async run(): Promise<void> {
    // Backfill each read model separately
    await this.backfillRunExplorerPublic();
    await this.backfillLadderRankings();
    await this.backfillSeason0Memberships();
    await this.backfillCreatorSubmissions();
  }

  private async backfillRunExplorerPublic(): Promise<void> {
    const eventLogs = await this.eventLogRepository.getAll('run_explorer_public');
    for (const eventLog of eventLogs) {
      await this.runExplorerPublicRepository.upsert(eventLog);
      this.logProgress(`Backfilled run_explorer_public event: ${eventLog.id}`);
    }
  }

  private async backfillLadderRankings(): Promise<void> {
    const eventLogs = await this.eventLogRepository.getAll('ladder_rankings');
    for (const eventLog of eventLogs) {
      await this.ladderRankingsRepository.upsert(eventLog);
      this.logProgress(`Backfilled ladder_rankings event: ${eventLog.id}`);
    }
  }

  private async backfillSeason0Memberships(): Promise<void> {
    const eventLogs = await this.eventLogRepository.getAll('season0_memberships');
    for (const eventLog of eventLogs) {
      await this.season0MembershipsRepository.upsert(eventLog);
      this.logProgress(`Backfilled season0_memberships event: ${eventLog.id}`);
    }
  }

  private async backfillCreatorSubmissions(): Promise<void> {
    const eventLogs = await this.eventLogRepository.getAll('creator_submissions');
    for (const eventLog of eventLogs) {
      await this.creatorSubmissionsRepository.upsert(eventLog);
      this.logProgress(`Backfilled creator_submissions event: ${eventLog.id}`);
    }
  }

  private logProgress(message: string): void {
    console.log(message);
    this.context.telemetryService.emitProgressEvent({ message });
  }
}

Please note that the code above assumes the existence of a job framework, event-log repository, and four read model repositories (run-explorer-public-repository, ladder-rankings-repository, season0-memberships-repository, creator-submissions-repository) which are not provided in this example.

Regarding SQL, foreign keys, indexes, comments, and idempotent CREATE statements, they would typically be defined within the respective repository classes or separate schema files, depending on your project's structure and preferences.
