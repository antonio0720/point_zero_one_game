import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { RolloutDashboardsService } from './rollout-dashboards.service';

describe('RolloutDashboardsService', () => {
let service: RolloutDashboardsService;
let httpMock: HttpTestingController;

beforeEach(() => {
TestBed.configureTestingModule({
imports: [HttpClientTestingModule],
providers: [RolloutDashboardsService]
});
service = TestBed.inject(RolloutDashboardsService);
httpMock = TestBed.inject(HttpTestingController);
});

it('should be created', () => {
expect(service).toBeTruthy();
});

describe('getRolloutDashboards', () => {
const mockGetRolloutDashboardsResponse = { dashboardData: [] };

it('should call GET API with correct endpoint and return expected response', () => {
service.getRolloutDashboards().subscribe((response) => {
expect(response).toEqual(mockGetRolloutDashboardsResponse);
});

const req = httpMock.expectOne('/api/rollout-dashboards');
expect(req.request.method).toBe('GET');

req.flush(mockGetRolloutDashboardsResponse);
});
});
});
