import { SkillRating5 } from '../skill-rating-5';
import { expect } from 'expect';
import { SpyObject } from 'jest-mock';

describe('Skill Rating 5', () => {
let skillRating: SkillRating5;
let mockDataService: SpyObject;

beforeEach(() => {
mockDataService = jest.spyOn(global, 'fetch').mockImplementation(() =>
Promise.resolve({
json: () => new Promise((resolve) => resolve([{ skillId: 1, rating: 4.5 }]))
})
);
skillRating = new SkillRating5();
});

it('should return the average skill rating', async () => {
const result = await skillRating.getAverageSkillRating(1);
expect(result).toEqual(4.5);
});

it('should throw an error if no skills found', async () => {
mockDataService.mockResolvedValueOnce({
json: () => new Promise((resolve) => resolve([]))
});
await expect(skillRating.getAverageSkillRating(1)).rejects.toThrowError('No skills found');
});

it('should fetch data from the API', async () => {
await skillRating.getAverageSkillRating(1);
expect(mockDataService).toHaveBeenCalledWith(`/api/skills/1`);
});
});
