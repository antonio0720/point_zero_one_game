import { AllowlistService } from '../services/allowlist.service';
import { Allowlist } from '../models/allowlist.model';
import { Injectable, forwardRef, NestJsExpressApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { HttpException, HttpStatus } from '@nestjs/common/dist/exceptions';
import { getConnection, Repository } from 'typeorm';
import { User } from '../auth/user.entity';
import { userProviders } from '../auth/auth.module';
import { AllowlistProvider } from '../providers/allowlist.provider';

describe('AllowlistService', () => {
let allowlistService: AllowlistService;
let allowlistRepository: Repository<Allowlist>;
let jwtService: JwtService;
let app: NestJsExpressApplication;

beforeAll(async () => {
const moduleFixture = await Test.createTestingModule({
imports: [AllowlistProvider],
providers: [AllowlistService, JwtService, ...userProviders],
})
.overrideProvider(JwtService)
.useValue({ sign: jest.fn(() => 'token') })
.compile();

app = moduleFixture.createNestApplication();
await app.init();

allowlistService = moduleFixture.get<AllowlistService>(AllowlistService);
jwtService = moduleFixture.get<JwtService>(JwtService);
allowlistRepository = getConnection().getRepository(Allowlist);
});

afterEach(async () => {
// clean up database after each test case
await allowlistRepository.query('TRUNCATE TABLE allowlists CASCADE');
});

describe('createAllowlist', () => {
it('should create a new allowlist and return its id', async () => {
const user: User = new User();
user.id = 1;

jest.spyOn(allowlistRepository, 'save').mockResolvedValue({ id: 1 });

const result = await allowlistService.createAllowlist(user);
expect(result).toEqual(expect.objectContaining({ id: 1 }));
});

it('should throw an error if the user is not found', async () => {
jest.spyOn(allowlistRepository, 'save').mockResolvedValueUndefined;

const user = {} as User;

await expect(allowlistService.createAllowlist(user)).rejects.toThrow(HttpException);
});
});

describe('getAllowlists', () => {
it('should return a list of allowlists for the authenticated user', async () => {
const user: User = new User();
user.id = 1;

const allowlist1 = new Allowlist();
allowlist1.userId = user.id;
await allowlistRepository.save(allowlist1);

const allowlist2 = new Allowlist();
allowlist2.userId = user.id;
await allowlistRepository.save(allowlist2);

jest.spyOn(allowlistRepository, 'find').mockResolvedValue([allowlist1, allowlist2]);

const result = await allowlistService.getAllowlists(user);
expect(result).toEqual(expect.arrayContaining([allowlist1, allowlist2]));
});
});
});
