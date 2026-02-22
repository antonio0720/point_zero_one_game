import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { of } from 'rxjs';

import { RolloutDashboardsService } from './rollout-dashboards.service';
import { LiveopsApiService } from '../liveops-api.service';

describe('RolloutDashboardsService', () => {
let service: RolloutDashboardsService;
let liveopsApiServiceSpy: jasmine.SpyObj<LiveopsApiService>;
let httpTestingController: HttpTestingController;

beforeEach(() => {
TestBed.configureTestingModule({
imports: [HttpClientTestingModule],
providers: [RolloutDashboardsService, LiveopsApiService]
});

service = TestBed.inject(RolloutDashboardsService);
liveopsApiServiceSpy = TestBed.inject(LiveopsApiService) as jasmine.SpyObj<LiveopsApiService>;
httpTestingController = TestBed.inject(HttpTestingController);
});

it('should be created', () => {
expect(service).toBeTruthy();
});

it('should call LiveOps API to get rollout dashboard data', () => {
const mockRolloutDashboards = [{}, {}];
liveopsApiServiceSpy.getLiveOpsData.and.returnValue(of(mockRolloutDashboards));

service.getRolloutDashboards().subscribe((data) => expect(data).toEqual(mockRolloutDashboards));

const req = httpTestingController.expectOne(`/liveops/seasons/rollout-dashboards`);
expect(req.request.method).toBe('GET');
req.flush(mockRolloutDashboards);
});
});
