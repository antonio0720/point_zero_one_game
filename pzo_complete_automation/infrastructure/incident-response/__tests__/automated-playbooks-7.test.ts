import { Test, TestingModule } from '@nestjs/testing';
import { AutomatedPlaybooksService } from './automated-playbooks.service';
import { AutomatedPlaybook } from './entities/automated-playbook.entity';
import { getConnectionToken, TypeOrmModule } from '@nestjs/typeorm';
import { CreateAutomatedPlaybookDto } from './dto/create-automated-playbook.dto';
import { UpdateAutomatedPlaybookDto } from './dto/update-automated-playbook.dto';

describe('AutomatedPlaybooksService', () => {
let service: AutomatedPlaybooksService;
let connection;

beforeAll(async () => {
const module: TestingModule = await Test.createTestingModule({
imports: [TypeOrmModule.forRoot()],
providers: [AutomatedPlaybooksService],
}).compile();

service = module.get<AutomatedPlaybooksService>(AutomatedPlaybooksService);
connection = module.get(getConnectionToken());
});

describe('create', () => {
it('should create an automated playbook', async () => {
const newAutomatedPlaybook: CreateAutomatedPlaybookDto = {
name: 'Test Playbook',
description: 'This is a test playbook',
steps: ['Step 1', 'Step 2'],
};
const result = await service.create(newAutomatedPlaybook);
expect(result).toBeInstanceOf(AutomatedPlaybook);
});
});

describe('findOne', () => {
it('should return the requested automated playbook', async () => {
const createdAutomatedPlaybook: AutomatedPlaybook = await connection
.createQueryBuilder('automated_playbooks')
.save(newAutomatedPlaybook);
const result = await service.findOne(createdAutomatedPlaybook.id);
expect(result).toEqual(createdAutomatedPlaybook);
});
});

describe('update', () => {
it('should update the requested automated playbook', async () => {
const updatedAutomatedPlaybook: UpdateAutomatedPlaybookDto = {
name: 'Updated Test Playbook',
};
await service.update(createdAutomatedPlaybook.id, updatedAutomatedPlaybook);
const result = await service.findOne(createdAutomatedPlaybook.id);
expect(result.name).toBe('Updated Test Playbook');
});
});
});
