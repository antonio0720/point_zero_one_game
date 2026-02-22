import { TestBed } from '@angular/core/testing';
import { GamePlayService } from './gameplay.service';
import { of } from 'rxjs';
import { DoctrineContracts3Service } from '../doctrine-contracts-3.service';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { HttpClientModule } from '@angular/common/http';

describe('GamePlayService', () => {
let service: GamePlayService;
let doctrineContracts3Service: DoctrineContracts3Service;
let httpTestingController: HttpTestingController;

beforeEach(() => {
TestBed.configureTestingModule({
imports: [HttpClientTestingModule, HttpClientModule],
providers: [GamePlayService, DoctrineContracts3Service]
});
service = TestBed.inject(GamePlayService);
doctrineContracts3Service = TestBed.inject(DoctrineContracts3Service);
httpTestingController = TestBed.inject(HttpTestingController);
});

it('should be created', () => {
expect(service).toBeTruthy();
});

describe('advancedGameplay', () => {
const advancedGameplayResponse = { /* your response structure */ };

it('should call DoctrineContracts3Service and return the correct response', () => {
const gameId = 'test-game-id';

doctrineContracts3Service.getAdvancedGameplayData.and.returnValue(of(advancedGameplayResponse));

service.advancedGameplay(gameId).subscribe((data) => {
expect(data).toEqual(advancedGameplayResponse);
expect(doctrineContracts3Service.getAdvancedGameplayData).toHaveBeenCalledWith(gameId);
});

const request = httpTestingController.expectOne(`/api/doctrine-contracts-3/${gameId}`);
expect(request.request.method).toBe('GET');

request.handler.respond({ status: 200, body: advancedGameplayResponse });
});
});
});
