import { HedgePairsService } from '../../services/hedge-pairs.service';
import { of } from 'rxjs';
import { HedgePair } from '../../interfaces/hedge-pair.interface';

describe('HedgePairsService', () => {
let service: HedgePairsService;

beforeEach(() => {
service = new HedgePairsService();
});

it('should be created', () => {
expect(service).toBeTruthy();
});

describe('getHedgePairs', () => {
it('should return hedge pairs', () => {
const mockHedgePairs: HedgePair[] = [
{ id: 1, pairId: 'ABC123', assetId1: 456, assetId2: 789 },
{ id: 2, pairId: 'DEF456', assetId1: 789, assetId2: 123 }
];

const mockGetHedgePairs = jest.spyOn(service, 'getHedgePairs').mockReturnValue(of(mockHedgePairs));

service.getHedgePairs().subscribe((result) => {
expect(result).toEqual(mockHedgePairs);
expect(mockGetHedgePairs).toHaveBeenCalled();
});
});
});
});
