import { TestBed } from '@angular/core/testing';
import { EnvironmentPromotion10Service } from '../../infrastructure/services/environment-promotion-10.service';
import { of } from 'rxjs';

describe('EnvironmentPromotion10Service', () => {
let service: EnvironmentPromotion10Service;

beforeEach(() => {
TestBed.configureTestingModule({});
service = TestBed.inject(EnvironmentPromotion10Service);
});

it('should be created', () => {
expect(service).toBeTruthy();
});

it('testMethodName', () => {
const data = { /* test data */ };
const expectedResult = { /* expected result */ };
spyOn(service, 'methodUnderTest').and.returnValue(of(expectedResult));

service.methodUnderTest(data).subscribe((result) => {
expect(result).toEqual(expectedResult);
});
});
});
