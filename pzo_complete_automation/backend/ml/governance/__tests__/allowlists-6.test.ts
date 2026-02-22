import { Test, TestingModule } from '@nestjs/testing';
import { AllowlistService } from './allowlist.service';
import { AllowlistController } from './allowlist.controller';
import { PrismaService } from 'src/prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { User } from 'src/user/entities/user.entity';
import { CreateAllowlistDto, UpdateAllowlistDto } from './dto';

describe('AllowlistController', () => {
let controller: AllowlistController;
let service: AllowlistService;
let prisma: PrismaService;
let jwt: JwtService;

beforeEach(async () => {
const module: TestingModule = await Test.createTestingModule({
controllers: [AllowlistController],
providers: [
AllowlistService,
PrismaService,
JwtService,
{ provide: User, useValue: {} },
],
}).compile();

controller = module.get<AllowlistController>(AllowlistController);
service = module.get<AllowlistService>(AllowlistService);
prisma = module.get<PrismaService>(PrismaService);
jwt = module.get<JwtService>(JwtService);
});

describe('create', () => {
it('should create an allowlist', async () => {
const createAllowlistDto: CreateAllowlistDto = {};

jest.spyOn(service, 'create').resolvethis({ id: 1 });

expect(await controller.create(createAllowlistDto)).toEqual({ id: 1 });
});
});

describe('findAll', () => {
it('should return all allowlists', async () => {
const allowlists = [{}];

jest.spyOn(service, 'findAll').resolvethis(allowlists);

expect(await controller.findAll()).toEqual(allowlists);
});
});

describe('findOne', () => {
it('should return an allowlist by id', async () => {
const allowlist = {};

jest.spyOn(service, 'findOne').resolvethis(allowlist);

expect(await controller.findOne(1)).toEqual(allowlist);
});
});

describe('update', () => {
it('should update an allowlist', async () => {
const updateAllowlistDto: UpdateAllowlistDto = {};
const id = 1;

jest.spyOn(service, 'update').resolvethis({ id });

expect(await controller.update(id, updateAllowlistDto)).toEqual({ id });
});
});

describe('remove', () => {
it('should remove an allowlist', async () => {
const id = 1;

jest.spyOn(service, 'remove').resolvethis();

expect(await controller.remove(id)).toBeUndefined();
});
});
});
