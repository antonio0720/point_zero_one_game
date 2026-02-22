import { Test, TestingModule } from '@nestjs/testing';
import { DashboardsController } from './dashboards.controller';
import { DashboardsService } from './dashboards.service';
import { Dashboard } from './entities/dashboard.entity';
import { GetDashboardDto } from './dto/get-dashboard.dto';
import { CreateDashboardDto } from './dto/create-dashboard.dto';
import { UpdateDashboardDto } from './dto/update-dashboard.dto';
import { NotFoundException } from '@nestjs/common';
import { of } from 'rxjs';

describe('DashboardsController', () => {
let controller: DashboardsController;
let service: DashboardsService;

beforeEach(async () => {
const module: TestingModule = await Test.createTestingModule({
controllers: [DashboardsController],
providers: [DashboardsService],
})
.overrideProvider(DashboardsService)
.useValue({
create: jest.fn(() => of(new Dashboard())),
findAll: jest.fn(() => of([new Dashboard(), new Dashboard()])),
findOne: jest.fn((id: number) =>
id ? of(new Dashboard()) : throw new NotFoundException(),
),
update: jest.fn((id: number, dto: UpdateDashboardDto) =>
of(new Dashboard()),
),
remove: jest.fn(() => of({ affected: 1 })),
})
.compile();

controller = module.get<DashboardsController>(DashboardsController);
service = module.get<DashboardsService>(DashboardsService);
});

describe('create', () => {
it('should create a new dashboard', async () => {
const createDto: CreateDashboardDto = new CreateDashboardDto();
const result = await controller.create(createDto);
expect(service.create).toHaveBeenCalledWith(createDto);
expect(result).toEqual(new Dashboard());
});
});

describe('findAll', () => {
it('should return an array of dashboards', async () => {
const result = await controller.findAll();
expect(service.findAll).toHaveBeenCalledTimes(1);
expect(result).toEqual([new Dashboard(), new Dashboard()]);
});
});

describe('findOne', () => {
const id = 1;

it('should return the dashboard', async () => {
const result = await controller.findOne(id);
expect(service.findOne).toHaveBeenCalledWith(id);
expect(result).toEqual(new Dashboard());
});

it('should throw NotFoundException if id not found', async () => {
await expect(controller.findOne(0)).rejects.toThrow(NotFoundException);
expect(service.findOne).toHaveBeenCalledWith(0);
});
});

describe('update', () => {
const id = 1;
const updateDto: UpdateDashboardDto = new UpdateDashboardDto();

it('should update the dashboard', async () => {
await controller.update(id, updateDto);
expect(service.update).toHaveBeenCalledWith(id, updateDto);
});
});

describe('remove', () => {
const id = 1;

it('should delete the dashboard', async () => {
await controller.remove(id);
expect(service.remove).toHaveBeenCalledWith(id);
});
});
});
