import { TestBed } from '@angular/core/testing';
import { CanaryRolloutsService } from './canary-rollouts.service';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { of } from 'rxjs';

describe('CanaryRolloutsService', () => {
let service: CanaryRolloutsService;
let httpMock: HttpTestingController;

beforeEach(() => {
TestBed.configureTestingModule({
imports: [HttpClientTestingModule],
providers: [CanaryRolloutsService]
});
service = TestBed.inject(CanaryRolloutsService);
httpMock = TestBed.inject(HttpTestingController);
});

it('should be created', () => {
expect(service).toBeTruthy();
});

it('should return correct canary rollout percentage', () => {
const serviceCall = service.getCanaryRolloutPercentage('feature-id');
const mockResponse = { percentage: 30 };

serviceCall.subscribe((data) => expect(data).toEqual(mockResponse));

const req = httpMock.expectOne('/api/canary-rollouts/feature-id');
expect(req.request.method).toBe('GET');
req.flush(mockResponse);

httpMock.verify();
});

it('should handle error when fetching canary rollout percentage', () => {
const serviceCall = service.getCanaryRolloutPercentage('feature-id');

const mockError = new Error('Network error');
const req = httpMock.expectOne('/api/canary-rollouts/feature-id');
req.error(mockError);

serviceCall.subscribe({
next: () => fail('Expected an error'),
error: (err) => expect(err).toEqual(mockError)
});

httpMock.verify();
});
});
