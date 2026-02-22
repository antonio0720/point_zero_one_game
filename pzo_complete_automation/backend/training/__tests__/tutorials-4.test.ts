import { Test, TestingModule } from '@nestjs/testing';
import { TutorialsController } from '../tutorials.controller';
import { TutorialsService } from '../tutorials.service';
import { CreateTutorialDto } from '../dto/create-tutorial.dto';
import { UpdateTutorialDto } from '../dto/update-tutorial.dto';

describe('TutorialsController', () => {
let controller: TutorialsController;
let service: TutorialsService;

beforeEach(async () => {
const module: TestingModule = await Test.createTestingModule({
controllers: [TutorialsController],
providers: [TutorialsService],
}).compile();

controller = module.get<TutorialsController>(TutorialsController);
service = module.get<TutorialsService>(TutorialsService);
});

it('should be defined', () => {
expect(controller).toBeDefined();
});

describe('create', () => {
it('should create a new tutorial', async () => {
const newTutorial: CreateTutorialDto = {
title: 'New Tutorial',
description: 'This is a new tutorial.',
};
jest.spyOn(service, 'create').resolves(newTutorial);

const created = await controller.create(newTutorial);
expect(created).toEqual(newTutorial);
expect(service.create).toHaveBeenCalledWith(newTutorial);
});
});

describe('findOne', () => {
it('should return the tutorial with given id', async () => {
const mockTutorial = { id: 1, title: 'Mock Tutorial' };
jest.spyOn(service, 'findOne').resolves(mockTutorial);

const found = await controller.findOne(1);
expect(found).toEqual(mockTutorial);
expect(service.findOne).toHaveBeenCalledWith(1);
});
});

describe('update', () => {
it('should update the tutorial with given id', async () => {
const mockTutorial = { id: 1, title: 'Mock Tutorial' };
const updateData: UpdateTutorialDto = { title: 'Updated Mock Tutorial' };
jest.spyOn(service, 'update').resolves(mockTutorial);

const updated = await controller.update(1, updateData);
expect(updated).toEqual(mockTutorial);
expect(service.update).toHaveBeenCalledWith(1, updateData);
});
});

describe('remove', () => {
it('should remove the tutorial with given id', async () => {
const mockTutorial = { id: 1, title: 'Mock Tutorial' };
jest.spyOn(service, 'remove').resolves(mockTutorial);

await controller.remove(1);
expect(service.remove).toHaveBeenCalledWith(1);
});
});
});
