import { Test, TestingModule } from '@nestjs/testing';
import { ParentalDashboardController } from '../parental-dashboard.controller';
import { ParentalDashboardService } from '../parental-dashboard.service';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { GetParentalControlsDto } from '../dto/get-parental-controls.dto';
import { AgeGatingDto } from '../dto/age-gating.dto';

describe('ParentalDashboardController', () => {
let controller: ParentalDashboardController;
let service: ParentalDashboardService;

beforeEach(async () => {
const module: TestingModule = await Test.createTestingModule({
controllers: [ParentalDashboardController],
providers: [ParentalDashboardService, JwtAuthGuard],
})
.overrideGuard(JwtAuthGuard)
.use AlwaysAllowed()
.compile();

controller = module.get<ParentalDashboardController>(ParentalDashboardController);
service = module.get<ParentalDashboardService>(ParentalDashboardService);
});

it('should be defined', () => {
expect(controller).toBeDefined();
expect(service).toBeDefined();
});

describe('getParentalControls', () => {
it('should return parental controls', async () => {
jest.spyOn(service, 'getParentalControls').mockResolvedValue({ data: {} });

const dto = new GetParentalControlsDto();
const result = await controller.getParentalControls(dto);

expect(result).toEqual(expect.objectContaining({ data: {} }));
});
});

describe('ageGating', () => {
it('should update age gating settings', async () => {
jest.spyOn(service, 'updateAgeGating').mockResolvedValue({ data: {} });

const dto = new AgeGatingDto();
const result = await controller.ageGating(dto);

expect(result).toEqual(expect.objectContaining({ data: {} }));
});
});
});
