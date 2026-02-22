import { Test, TestingModule } from '@nestjs/testing';
import { AutomatedDeletionService } from './automated-deletion.service';
import { DeletableEntityRepository } from './deletable-entity.repository';
import { getConnectionToken, TypeOrmModule } from '@nestjs/typeorm';
import { CreateDeletableEntityDto } from './dto/create-deletable-entity.dto';
import { DeletableEntity } from './entities/deletable-entity.entity';
import { of } from 'rxjs';
import * as sinon from 'sinon';
import { Injectable, Logger } from '@nestjs/common';

describe('AutomatedDeletionService', () => {
let service: AutomatedDeletionService;
let repository: DeletableEntityRepository;
let logger: Logger;

beforeEach(async () => {
const module: TestingModule = await Test.createTestingModule({
imports: [TypeOrmModule.forRoot()],
providers: [AutomatedDeletionService, DeletableEntityRepository],
})
.overrideProvider(getConnectionToken())
.useValue(sinon.createStubInstance())
.compile();

service = module.get<AutomatedDeletionService>(AutomatedDeletionService);
repository = module.get<DeletableEntityRepository>(DeletableEntityRepository);
logger = module.get<Logger>(Logger);
});

it('should create a new deletable entity', async () => {
const createDto: CreateDeletableEntityDto = { name: 'Test Entity' };
const createdEntity: DeletableEntity = new DeletableEntity();
createdEntity.name = createDto.name;

sinon.stub(repository, 'create').resolves(createdEntity);
sinon.stub(repository, 'save').resolves(createdEntity);

const result = await service.createDeletableEntity(createDto);
expect(result).toEqual(createdEntity);
});

it('should delete a deletable entity', async () => {
const testEntity: DeletableEntity = new DeletableEntity();
testEntity.name = 'Test Entity';

sinon.stub(repository, 'findOne').resolves(testEntity);
sinon.stub(repository, 'remove').resolves();
sinon.stub(repository, 'save').resolves();

await service.deleteDeletableEntity(testEntity.id);

expect(repository.findOne).toHaveProperty('calledOnce');
expect(repository.remove).toHaveProperty('calledOnceWith', testEntity);
});

it('should handle errors during deletion', async () => {
const testEntity: DeletableEntity = new DeletableEntity();
testEntity.name = 'Test Entity';

sinon.stub(repository, 'findOne').resolves(testEntity);
sinon.stub(repository, 'remove').rejects(new Error('Error during deletion'));
sinon.stub(repository, 'save').resolves();

await expect(service.deleteDeletableEntity(testEntity.id)).rejects.toThrow('Error during deletion');
});
});
