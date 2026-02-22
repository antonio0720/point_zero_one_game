import { Test, TestingModule } from '@nestjs/testing';
import { ReleaseService } from '../services/release.service';
import { CanaryManagementService } from './canary-management.service';
import { RollbackConsoleCanary10Handler } from './rollback-console-canary-10.handler';

describe('CanaryManagementService', () => {
let canaryManagementService: CanaryManagementService;
let releaseService: ReleaseService;
let rollbackConsoleCanary10Handler: RollbackConsoleCanary10Handler;

beforeEach(async () => {
const module: TestingModule = await Test.createTestingModule({
providers: [
CanaryManagementService,
ReleaseService,
RollbackConsoleCanary10Handler,
{
provide: RollbackConsoleCanary10Handler,
useValue: jasmine.createMock(RollbackConsoleCanary10Handler),
},
],
}).compile();

canaryManagementService = module.get<CanaryManagementService>(CanaryManagementService);
releaseService = module.get<ReleaseService>(ReleaseService);
rollbackConsoleCanary10Handler = module.get<RollbackConsoleCanary10Handler>(RollbackConsoleCanary10Handler);
});

describe('rollbackConsole', () => {
it('should rollback release with canary-management-10', async () => {
// arrange
const releaseId = 'test-release-id';
jest.spyOn(releaseService, 'getReleaseById').mockResolvedValue({ id: releaseId });
jest.spyOn(rollbackConsoleCanary10Handler, 'execute').mockResolvedValue();

// act
await canaryManagementService.rollbackConsole(releaseId);

// assert
expect(releaseService.getReleaseById).toHaveBeenCalledWith(releaseId);
expect(rollbackConsoleCanary10Handler.execute).toHaveBeenCalled();
});
});
});
