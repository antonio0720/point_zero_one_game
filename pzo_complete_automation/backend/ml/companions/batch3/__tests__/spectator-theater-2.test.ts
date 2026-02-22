import { TestBed } from '@angular/core/testing';
import { Spectator Theater2Component } from './spectator-theater-2.component';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { of, throwError } from 'rxjs';
import { SpectatorTheater2Service } from './spectator-theater-2.service';
import { MockProvider } from 'ng-mocks';

describe('SpectatorTheater2Component', () => {
let component: SpectatorTheater2Component;
let fixture: any;
let service: SpectatorTheater2Service;
let httpMock: HttpTestingController;

beforeEach(() => {
TestBed.configureTestingModule({
imports: [HttpClientTestingModule],
providers: [
MockProvider(SpectatorTheater2Service),
]
});

fixture = TestBed.createComponent(SpectatorTheater2Component);
component = fixture.componentInstance;
service = TestBed.inject(SpectatorTheater2Service);
httpMock = TestBed.inject(HttpTestingController);
});

it('should create', () => {
expect(component).toBeTruthy();
});

describe('when the service returns data', () => {
const mockData = { /*... your mock data ...*/ };

beforeEach(() => {
service.getData().subscribe((data) => expect(data).toEqual(mockData));
});

it('should call getData method from service', () => {
const request = httpMock.expectOne('/api/spectator-theater-2');
expect(request.cancelled).toBeFalsy();
request.flush(mockData);

httpMock.verify();
});
});

describe('when the service throws an error', () => {
beforeEach(() => {
service.getData().subscribe(() => {}, (error) => expect(error).toBeTruthy());
});

it('should call getData method from service', () => {
const request = httpMock.expectOne('/api/spectator-theater-2');
expect(request.cancelled).toBeFalsy();
request.error(new ErrorEvent('Test Error'));

httpMock.verify();
});
});
});
