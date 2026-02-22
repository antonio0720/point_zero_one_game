import { Test, TestingModule } from '@nestjs/testing';
import { EventTaxonomy3Service } from './event-taxonomy-3.service';
import { EventTaxonomy3Controller } from './event-taxonomy-3.controller';

describe('EventTaxonomy3', () => {
let service: EventTaxonomy3Service;
let controller: EventTaxonomy3Controller;

beforeEach(async () => {
const module: TestingModule = await Test.createTestingModule({
controllers: [EventTaxonomy3Controller],
providers: [EventTaxonomy3Service],
}).compile();

service = module.get<EventTaxonomy3Service>(EventTaxonomy3Service);
controller = module.get<EventTaxonomy3Controller>(EventTaxonomy3Controller);
});

it('should be defined', () => {
expect(service).toBeDefined();
expect(controller).toBeDefined();
});

// Add your test cases here...
});
