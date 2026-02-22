import { ShareService } from '../services/share.service';
import { of } from 'rxjs';
import { SettlementService } from '../services/settlement.service';
import { TestBed, inject } from '@angular/core/testing';
import { SharedModule } from '../shared.module';

describe('Settlement - share-7', () => {
let shareService: ShareService;
let settlementService: SettlementService;

beforeEach(() => {
TestBed.configureTestingModule({
imports: [SharedModule],
});

inject([ShareService, SettlementService], (service: ShareService, settlement: SettlementService) => {
shareService = service;
settlementService = settlement;
});
});

it('should perform share-7 test case', () => {
// Arrange
const settlementDataMock = {};
const shareResultMock = {};

spyOn(settlementService, 'getSettlementData').and.returnValue(of(settlementDataMock));
spyOn(shareService, 'performShare').and.callFake((data) => of(shareResultMock));

// Act
shareService.performShare7().subscribe((result) => {
expect(result).toEqual(shareResultMock);
expect(settlementService.getSettlementData).toHaveBeenCalled();
});
});
});
