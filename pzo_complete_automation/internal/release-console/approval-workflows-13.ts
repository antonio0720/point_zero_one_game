import { Service, Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Job } from 'bullmq';
import { Queue } from 'bull';

@Service()
@Injectable()
export class ApprovalWorkflows13Service {
private readonly logger = new Logger(ApprovalWorkflows13Service.name);

constructor(private readonly queue: Queue) {}

@Cron(CronExpression.EVERY_MINUTE)
async handle() {
this.logger.log('Checking for pending approval tasks');

const pendingJobs = await this.queue.getPendingJobs();

if (pendingJobs.length > 0) {
this.logger.log(`Found ${pendingJobs.length} pending jobs`);

for (const job of pendingJobs) {
this.logger.log(`Processing job ${job.id}`);
await job.approve();
this.logger.log(`Job ${job.id} approved and processing...`);
}
} else {
this.logger.log('No pending jobs found');
}
}
}
