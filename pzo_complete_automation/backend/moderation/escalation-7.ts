import { Injectable } from '@nestjs/common';
import { BanRepository } from './ban.repository';
import { AbuseReport } from './abuse-report.entity';
import { BanReason } from './ban-reason.enum';

@Injectable()
export class ModerationService {
constructor(private banRepo: BanRepository) {}

async handleAbuseReport(report: AbuseReport) {
const user = report.user;
let action: 'warning' | 'ban' = 'warning';

// Check if the user has a previous warning
const warnings = await this.banRepo.countWarnings(user.id);
if (warnings >= 3) {
action = 'ban';
}

// Update the user's warning count
await this.banRepo.incrementWarningCount(user.id);

// Perform the appropriate action based on the decision
if (action === 'warning') {
console.log(`User ${user.username} has received a warning.`);
} else {
const banReason = BanReason.REPEATED_ABUSE;
await this.banRepo.addBan(user, banReason);
console.log(`User ${user.username} has been permanently banned for repeated abuse.`);
}
}
}
