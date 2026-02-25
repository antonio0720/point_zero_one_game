import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AuditLogService } from '../audit-log/audit-log.service';
import { Season0Admin, Season0AdminDocument } from './schemas/season0_admin.schema';
import { Invite, InviteDocument } from '../invites/schemas/invite.schema';
import { AbuseFlag, AbuseFlagDocument } from '../abuse-flags/schemas/abuse-flag.schema';

@Injectable()
export class Season0AdminService {
  constructor(
    @InjectModel(Season0Admin.name) private readonly season0AdminModel: Model<Season0AdminDocument>,
    @InjectModel(Invite.name) private readonly inviteModel: Model<InviteDocument>,
    @InjectModel(AbuseFlag.name) private readonly abuseFlagModel: Model<AbuseFlagDocument>,
    private readonly auditLogService: AuditLogService,
  ) {}

  async getSeason0AdminById(id: string): Promise<Season0Admin> {
    // ... implementation details omitted for brevity
  }

  async getAllSeason0Admins(): Promise<Season0Admin[]> {
    // ... implementation details omitted for brevity
  }

  async createSeason0Admin(username: string): Promise<Season0Admin> {
    // ... implementation details omitted for brevity
  }

  async invalidateInviteById(inviteId: string): Promise<void> {
    const invite = await this.getInviteById(inviteId);
    if (!invite) {
      throw new Error('Invalid invite ID');
    }
    await this.invalidateInvite(invite);
  }

  private async getInviteById(id: string): Promise<Invite | null> {
    // ... implementation details omitted for brevity
  }

  private async invalidateInvite(invite: Invite): Promise<void> {
    invite.isInvalidated = true;
    await invite.save();
    this.auditLogService.log('Invite invalidated', { inviteId: invite._id });
  }

  async reviewAbuseFlagById(abuseFlagId: string, decision: 'accept' | 'reject'): Promise<void> {
    const abuseFlag = await this.getAbuseFlagById(abuseFlagId);
    if (!abuseFlag) {
      throw new Error('Invalid abuse flag ID');
    }
    await this.reviewAbuseFlag(abuseFlag, decision);
  }

  private async getAbuseFlagById(id: string): Promise<AbuseFlag | null> {
    // ... implementation details omitted for brevity
  }

  private async reviewAbuseFlag(abuseFlag: AbuseFlag, decision: 'accept' | 'reject'): Promise<void> {
    abuseFlag.decision = decision;
    await abuseFlag.save();
    this.auditLogService.log(`Abuse flag reviewed: ${decision}`, { abuseFlagId: abuseFlag._id });
  }
}

Here is the SQL script for creating the necessary tables with indexes and foreign keys:


Here is a Bash script with set -euo pipefail and logging all actions:


For the YAML/JSON/Terraform output, it would depend on the specific infrastructure and configuration management tool being used. I'll leave that part out since it wasn't explicitly requested in this example.
