import { Test, TestingModule } from '@nestjs/testing';
import { CohortAnalysisService } from './cohort-analysis.service';
import { CohortAnalysisController } from './cohort-analysis.controller';
import { AnalyticsService } from 'src/analytics/analytics.service';
import { WarehouseModule } from '../warehouse.module';

describe('CohortAnalysisController', () => {
let controller: CohortAnalysisController;
let service: CohortAnalysisService;
let analyticsService: AnalyticsService;

beforeEach(async () => {
const module: TestingModule = await Test.createTestingModule({
imports: [WarehouseModule],
controllers: [CohortAnalysisController],
providers: [CohortAnalysisService, AnalyticsService],
}).compile();

controller = module.get<CohortAnalysisController>(CohortAnalysisController);
service = module.get<CohortAnalysisService>(CohortAnalysisService);
analyticsService = module.get<AnalyticsService>(AnalyticsService);
});

it('should be defined', () => {
expect(controller).toBeDefined();
expect(service).toBeDefined();
expect(analyticsService).toBeDefined();
});

// Add test cases for the cohort analysis methods here.
});
