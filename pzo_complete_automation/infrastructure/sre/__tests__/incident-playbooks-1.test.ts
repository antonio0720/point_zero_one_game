import { Test, TestingModule } from '@nestjs/testing';
import { IncidentPlaybooksService } from './incident-playbooks.service';
import { IncidentPlaybookController } from './incident-playbook.controller';

describe('IncidentPlaybook Controller', () => {
let controller: IncidentPlaybookController;
let service: IncidentPlaybooksService;

beforeEach(async () => {
const module: TestingModule = await Test.createTestingModule({
controllers: [IncidentPlaybookController],
providers: [IncidentPlaybooksService],
}).compile();

controller = module.get<IncidentPlaybookController>(IncidentPlaybookController);
service = module.get<IncidentPlaybooksService>(IncidentPlaybooksService);
});

it('should be defined', () => {
expect(controller).toBeDefined();
expect(service).toBeDefined();
});

describe('handleIncident', () => {
it('should call the appropriate method in the service', () => {
jest.spyOn(service, 'executeIncidentPlaybook').mockResolvedValue(true);

controller.handleIncident({ incidentData: {} });

expect(service.executeIncidentPlaybook).toHaveBeenCalledWith({ incidentData: {} });
});
});
});
