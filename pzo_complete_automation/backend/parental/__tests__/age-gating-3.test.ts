import { Test, TestingModule } from '@nestjs/testing';
import { AgeGatingService } from '../age-gating.service';
import { User } from '../user.entity';
import { getConnection, Connection } from 'typeorm';

describe('AgeGatingService', () => {
let service: AgeGatingService;
let connection: Connection;

beforeAll(async () => {
const module: TestingModule = await Test.createTestingModule({
providers: [AgeGatingService],
}).compile();

service = module.get<AgeGatingService>(AgeGatingService);
connection = getConnection();
});

it('should be defined', () => {
expect(service).toBeDefined();
});

describe('consentCheck', () => {
it('should return true if user is over 18 and has consented', async () => {
// Setup a user that is over 18 and has consented
const user = new User();
user.age = 20;
user.hasConsent = true;

// Save the user to the database
await connection.manager.save(user);

expect(await service.consentCheck(user)).toBe(true);
});

it('should return false if user is under 18 or has not consented', async () => {
// Setup a user that is under 18 and has not consented
const user = new User();
user.age = 15;
user.hasConsent = false;

// Save the user to the database
await connection.manager.save(user);

expect(await service.consentCheck(user)).toBe(false);
});
});
});
