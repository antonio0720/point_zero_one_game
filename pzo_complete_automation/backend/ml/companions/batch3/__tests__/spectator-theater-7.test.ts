import { TestBed } from '@angular/core/testing';
import { Spectator Theater7Module } from './spectator-theater-7.module';
import { SpectatorTheater7Component } from './spectator-theater-7.component';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';

describe('SpectatorTheater7Component', () => {
let component: SpectatorTheater7Component;
let fixture: any;
let httpMock: HttpTestingController;

beforeEach(() => {
TestBed.configureTestingModule({
imports: [SpectatorTheater7Module, HttpClientTestingModule],
});
fixture = TestBed.createComponent(SpectatorTheater7Component);
component = fixture.componentInstance;
httpMock = TestBed.inject(HttpTestingController);
});

it('should create', () => {
expect(component).toBeTruthy();
});

// Add more test cases as needed for the SpectatorTheater7Component
});
