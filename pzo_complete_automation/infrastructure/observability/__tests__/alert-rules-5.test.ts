import { Test, TestingModule } from '@nestjs/testing';
import { AlertRulesService } from './alert-rules.service';
import { Observable, of } from 'rxjs';
import { AlertRuleEntity } from '../entities/alert-rule.entity';
import { AlertRule } from '../../../api/generated/alert_rule';
import { getConnectionToken } from '@nestjs/typeorm';

describe('AlertRulesService', () => {
let service: AlertRulesService;

beforeEach(async () => {
const module: TestingModule = await Test.createTestingModule({
providers: [AlertRulesService],
}).compile();

service = module.get<AlertRulesService>(AlertRulesService);
});

it('should be defined', () => {
expect(service).toBeDefined();
});

describe('findOneById', () => {
const mockFindOne = jest.fn().mockResolvedValue({ entity: new AlertRuleEntity() });

beforeEach(() => {
jest.spyOn(service, 'dataSource.getRepository', 'getMockRepository').mockImplementation((type) => {
if (type === AlertRuleEntity) {
return { findOne: mockFindOne };
}
});
});

it('should return an alert rule when the id is found', () => {
const id = 1;
mockFindOne.mockReturnValueOnce(of({ entity: { id, name: 'test-rule' } }));

service.findOneById(id).subscribe((result) => {
expect(result).toEqual(new AlertRule({ id, name: 'test-rule' }));
});
});

it('should throw an error when the id is not found', () => {
const id = 1;
mockFindOne.mockReturnValueOnce(of(null));

service.findOneById(id).subscribe(() => {}, (error) => {
expect(error).toEqual('Alert Rule not found');
});
});
});

describe('create', () => {
const mockSave = jest.fn().mockResolvedValue({ entity: new AlertRuleEntity() });

beforeEach(() => {
jest.spyOn(service, 'dataSource.getRepository', 'getMockRepository').mockImplementation((type) => {
if (type === AlertRuleEntity) {
return { save: mockSave };
}
});
});

it('should create an alert rule and return it when saved successfully', () => {
const newAlertRule: Omit<AlertRule, 'id'> = { name: 'test-rule' };
mockSave.mockReturnValueOnce(of({ entity: { ...newAlertRule, id: 1 } }));

service.create(newAlertRule).subscribe((result) => {
expect(result).toEqual(new AlertRule({ ...newAlertRule, id: 1 }));
});
});
});
});
