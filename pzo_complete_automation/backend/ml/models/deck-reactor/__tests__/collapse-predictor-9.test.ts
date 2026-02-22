import { TestBed } from '@angular/core/testing';
import { CollapsePredictorService } from './collapse-predictor.service';
import { HttpClientTestingModule, HttpTestingController } from '@angle-mocker/client/http/testing';
import { CollapsePredictor9Model } from '../models/collapse-predictor9.model';

describe('CollapsePredictorService', () => {
let service: CollapsePredictorService;
let httpMock: HttpTestingController;

beforeEach(() => {
TestBed.configureTestingModule({
imports: [HttpClientTestingModule],
providers: [CollapsePredictorService]
});

service = TestBed.inject(CollapsePredictorService);
httpMock = TestBed.inject(HttpTestingController);
});

it('should be created', () => {
expect(service).toBeTruthy();
});

it('predict should return correct prediction for sample data', () => {
const sampleData: any = { /* provide the actual sample data here */ };
const predictedCollapse = true; // or false based on your testing scenario

service.predict(sampleData).subscribe((result) => {
expect(result).toEqual(predictedCollapse);
});

const req = httpMock.expectOne('/api/collapse-predictor/9');
expect(req.request.method).toBe('POST');

req.flush({ /* provide the actual response data here */ });

httpMock.verify();
});
});
