import { cohortAnalysis } from '../cohort-analysis';
import { User, DayData } from '../../models';
import { MockClient, Db } from 'mongodb';

describe('Cohort Analysis', () => {
let db: Db;
let client: MockClient;

beforeAll(async () => {
client = new MockClient();
db = client.db('test');
});

afterAll(() => client.close());

it('should calculate cohort analysis correctly', async () => {
const usersCollection = db.collection('users') as unknown as User[];
const dayDataCollection = db.collection('day_data') as unknown as DayData[];

// Set up test data for users and day_data collections

const result = await cohortAnalysis(usersCollection, dayDataCollection);

expect(result).toEqual({
// Define your expected output structure here
});
});
});
