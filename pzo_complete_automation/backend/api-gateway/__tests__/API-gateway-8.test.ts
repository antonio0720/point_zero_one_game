import { Test, TestingModule } from '@nestjs/testing';
import { APIGatewayService } from './api-gateway.service';
import { HttpClientTestingModule, HttpTestingController } from '@nestjs/common/testing';
import { of } from 'rxjs';

describe('API Gateway', () => {
let service: APIGatewayService;
let controller: any;
let httpMock: HttpTestingController;

beforeEach(async () => {
const module: TestingModule = await Test.createTestingModule({
providers: [APIGatewayService],
imports: [HttpClientTestingModule],
}).compile();

service = module.get<APIGatewayService>(APIGatewayService);
controller = module.get(APIGatewayController);
httpMock = module.get(HttpTestingController);
});

it('should be defined', () => {
expect(service).toBeDefined();
});

describe('calling the service method', () => {
it('should return the expected data when API call is successful', () => {
const mockResponse = { data: 'Expected response' };
service.apiCall = jasmine.createSpy().and.returnValue(of(mockResponse));

httpMock.expectOne('/expected-api-url').flush(mockResponse);

service.callApi('/expected-api-url')
.subscribe((response) => expect(response).toEqual(mockResponse));

httpMock.verify();
});

it('should handle API errors', () => {
const mockError = new Error('API error');
service.apiCall = jasmine.createSpy().and.throwError(mockError);

httpMock.expectOne('/expected-api-url-with-error').flush(null, { status: 500, statusText: 'Internal Server Error' });

service.callApi('/expected-api-url-with-error')
.subscribe(() => fail('Expected an error'))
.catch((error) => expect(error).toEqual(mockError));

httpMock.verify();
});
});
});
