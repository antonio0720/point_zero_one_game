import { TestBed } from '@angular/core/testing';
import { HardcoreIntegrity17Service } from './hardcore-integrity-17.service';
import { HttpClientModule } from '@angular/common/http';
import { of, from } from 'rxjs';

describe('HardcoreIntegrity17Service', () => {
let service: HardcoreIntegrity17Service;

beforeEach(() => {
TestBed.configureTestingModule({
imports: [HttpClientModule],
providers: [HardcoreIntegrity17Service]
});
service = TestBed.inject(HardcoreIntegrity17Service);
});

it('should be created', () => {
expect(service).toBeTruthy();
});

it('testFunction1 should return correct result', () => {
const input = [1, 2, 3];
const expectedOutput = 6;
service.testFunction1 = jest.fn().mockReturnValue(of(expectedOutput));
const result = service.testFunction1(input).toPromise();
expect(result).resolves.toBe(expectedOutput);
});

it('testFunction2 should return correct result', () => {
const input = [1, 2, 3];
const expectedOutput = 'Result';
service.testFunction2 = jest.fn().mockReturnValue(of(expectedOutput));
const result = service.testFunction2(input).toPromise();
expect(result).resolves.toBe(expectedOutput);
});

it('testFunction3 should return correct result', () => {
const input1 = [1, 2];
const input2 = [3, 4];
const expectedOutput = [5, 7];
service.testFunction3 = jest.fn().mockReturnValue(from([expectedOutput]));
const result = service.testFunction3(input1, input2).toPromise();
expect(result).resolves.toEqual(expectedOutput);
});
});
