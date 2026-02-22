import { SkillRating15 } from '../../../src/backend/ml/behavioral/skill-rating-15';
import { DataLoader } from '@google-cloud/bigquery';
import { BigQuery } from '@google-cloud/bigquery';
import { Jest } from '@google-cloud/jest';
import { mockBigQuery } from '../../__mocks__/bigquery';

describe('SkillRating15', () => {
const bigquery = new BigQuery();
const dataLoader = DataLoader(bigquery);
jest.mock('@google-cloud/bigquery');

beforeEach(() => {
(BigQuery as jest.Mock).mockImplementationOnce(mockBigQuery);
});

it('should calculate skill rating 15 correctly', async () => {
// Mock BigQuery queries and return expected data

const skillRating15 = new SkillRating15();
const result = await skillRating15.calculate();

expect(result).toEqual({ /* expected output */ });
});
});
