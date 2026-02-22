import { BiometricsModule } from '../../../mobile/src/lib/biometrics.module';
import { BiometricsService } from '../../../mobile/src/lib/biometrics.service';
import { NgZone } from '@angular/core';
import { of } from 'rxjs';
import { AppModule } from '../../../mobile/src/app/app.module';
import { TestBed, async } from '@angular/core/testing';

describe('BiometricsService', () => {
let service: BiometricsService;
let zone: NgZone;

beforeEach(async(() => {
TestBed.configureTestingModule({
imports: [AppModule, BiometricsModule],
}).compileComponents();

service = TestBed.get(BiometricsService);
zone = TestBed.get(NgZone);
}));

it('should be created', () => {
expect(service).toBeTruthy();
});

// Add more test cases for biometrics-8 function here
});
