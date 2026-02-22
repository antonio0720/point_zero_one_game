import { ModerationQueueService } from '../../services/moderation-queue.service';
import { User } from '../../entities/user.entity';
import { BanReason } from '../../enums/ban-reason.enum';
import { ModuleRef } from '@nestjs/core';
import { getConnection, QueryBuilder } from 'typeorm';
import { Injectable, OnModuleInit } from '@nestjs/common';
import { CreateUserDto } from '../../dto/create-user.dto';
import { BanUserDto } from '../../dto/ban-user.dto';
import { UpdateUserDto } from '../../dto/update-user.dto';

@Injectable()
class TestModerationQueueService implements OnModuleInit {
private moderationQueueService: ModerationQueueService;

async onModuleInit() {
this.moderationQueueService = await ModuleRef(this.constructor.context).get(ModerationQueueService);
}

public async createUser(userData: CreateUserDto) {
return this.moderationQueueService.createUser(userData);
}

public async banUser(userId: number, banData: BanUserDto) {
return this.moderationQueueService.banUser(userId, banData);
}

public async updateUser(userId: number, userData: UpdateUserDto) {
return this.moderationQueueService.updateUser(userId, userData);
}

public async getUserById(userId: number): Promise<User | null> {
const connection = getConnection();
const userRepository = connection.getRepository(User);
const queryBuilder: QueryBuilder<User> = userRepository.createQueryBuilder('user');
return queryBuilder.where('user.id = :userId', { userId }).setOptions({ failIfNoRows: true }).getOne();
}
}

describe('ModerationQueueService', () => {
let moderationQueueService: ModerationQueueService;
let testModerationQueueService: TestModerationQueueService;

beforeEach(async () => {
const moduleRef = await Test.createTestingModule({
providers: [ModerationQueueService, TestModerationQueueService],
}).compile();

moderationQueueService = moduleRef.get<ModerationQueueService>(ModerationQueueService);
testModerationQueueService = moduleRef.get<TestModerationQueueService>(TestModerationQueueService);
});

it('should create a user', async () => {
const newUserData: CreateUserDto = {
username: 'test_user',
email: 'test@example.com',
password: 'password123',
displayName: 'Test User',
};

await testModerationQueueService.createUser(newUserData);
const createdUser = await moderationQueueService.getUserById(1); // assuming the created user has id 1
expect(createdUser).toBeDefined();
expect(createdUser?.username).toEqual('test_user');
});

it('should ban a user', async () => {
const newUser = await testModerationQueueService.createUser({
username: 'banned_user',
email: 'banned@example.com',
password: 'password123',
displayName: 'Banned User',
});

const banData: BanUserDto = {
reason: BanReason.Abuse,
description: 'The user has been abusive towards other users.',
};

await testModerationQueueService.banUser(newUser.id, banData);
const bannedUser = await moderationQueueService.getUserById(newUser.id);
expect(bannedUser?.isBanned).toBeTruthy();
});

it('should update a user', async () => {
const newUser = await testModerationQueueService.createUser({
username: 'updated_user',
email: 'updated@example.com',
password: 'password123',
displayName: 'Updated User',
});

const updateData: UpdateUserDto = {
displayName: 'New Updated User',
};

await testModerationQueueService.updateUser(newUser.id, updateData);
const updatedUser = await moderationQueueService.getUserById(newUser.id);
expect(updatedUser?.displayName).toEqual('New Updated User');
});
});
