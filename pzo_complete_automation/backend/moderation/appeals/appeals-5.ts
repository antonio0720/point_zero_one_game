import { Injectable } from '@nestjs/common';
import { Ban as BanEntity, User as UserEntity, Appeal as AppealEntity } from '../entities';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, getConnection } from 'typeorm';
import { BanService } from './ban.service';
import { UserService } from './user.service';
import { AppealDto } from '../dtos';
import { NotificationService } from '../../notifications/notification.service';

@Injectable()
export class AppealsService {
constructor(
@InjectRepository(AppealEntity) private readonly appealRepository: Repository<AppealEntity>,
private banService: BanService,
private userService: UserService,
private notificationService: NotificationService,
) {}

async createAppeal(userId: number, reason: string): Promise<AppealEntity> {
const user = await this.userService.findOne(userId);
if (!user) throw new Error('User not found');

const ban = await this.banService.findActiveBansByUserId(userId);
if (ban && ban.length > 0) {
const appeal = this.appealRepository.create({ userId, reason });
await this.appealRepository.save(appeal);
await this.notificationService.sendNotification(`Appeal created for user ${user.username}`, 'MODERATOR');
} else {
throw new Error('User is not banned');
}

return appeal;
}

async getAppeals(): Promise<AppealEntity[]> {
return this.appealRepository.find({ relations: ['user'] });
}

async decideOnAppeal(id: number, decision: boolean): Promise<void> {
const appeal = await this.appealRepository.findOne(id, { relations: ['user', 'ban'] });
if (!appeal) throw new Error('Appeal not found');

const ban = appeal.ban;
const user = await this.userService.findOne(appeal.userId);

if (decision) {
ban.isAccepted = true;
ban.endTime = getConnection()
.createQueryBuilder('ban', 'b')
.select('DATE_ADD(NOW(), INTERVAL b.duration YEAR_MONTH)')
.where('b.id = :banId', { banId: ban.id })
.getRawOne();
await this.banService.save(ban);

// Send notification to user and moderator
await this.notificationService.sendNotification(`Ban lifted for user ${user.username}`, 'MODERATOR');
await this.notificationService.sendNotification(`Your ban has been lifted`, user.email);
} else {
// Deny the appeal, keep the ban active or extend it if necessary
// ...

// Send notification to user and moderator
await this.notificationService.sendNotification(`Appeal denied for user ${user.username}`, 'MODERATOR');
await this.notificationService.sendNotification(`Your appeal has been denied`, user.email);
}
}
}
