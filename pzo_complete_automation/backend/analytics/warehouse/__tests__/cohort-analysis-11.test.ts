import { CohortAnalysis } from '../../../src/backend/analytics/warehouse/cohort-analysis';
import { User, UserEvent } from '../../../src/backend/models';
import { Database } from '../../../src/backend/database';
import sinon from 'sinon';
import chai, { expect } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import dayjs from 'dayjs';

chai.use(chaiAsPromised);

describe('Cohort Analysis', () => {
let db: Database;
let cohortAnalysis: CohortAnalysis;

beforeEach(() => {
db = new Database();
cohortAnalysis = new CohortAnalysis(db);
});

it('should calculate cohort analysis correctly', async () => {
// Prepare data
const users: User[] = [
{ id: 1, createdAt: dayjs('2022-01-01') },
{ id: 2, createdAt: dayjs('2022-01-02') },
{ id: 3, createdAt: dayjs('2022-01-03') },
{ id: 4, createdAt: dayjs('2022-01-05') },
];
const events: UserEvent[] = [
{ userId: 1, eventType: 'signup', timestamp: dayjs('2022-01-03') },
{ userId: 2, eventType: 'purchase', timestamp: dayjs('2022-01-05') },
{ userId: 3, eventType: 'signup', timestamp: dayjs('2022-01-06') },
{ userId: 4, eventType: 'purchase', timestamp: dayjs('2022-01-07') },
];

// Stub the database methods
const stubFind = sinon.stub(User, 'findAll').resolves(users);
const stubFindByQuery = sinon.stub(User, 'findByQuery').resolves([]);
const stubAssociate = sinon.stub(User, 'associate');
const stubInclude = sinon.stub(User, 'include').resolves({});
const stubCount = sinon.stub(UserEvent, 'count').resolves(3); // assuming there are 3 events for each user in this example

// Call the cohort analysis function
const result = await cohortAnalysis.runCohortAnalysis(dayjs('2022-01-01'));

// Assert the results
expect(result).to.deep.equal([
{
date: dayjs('2022-01-01'),
newUsersCount: 1,
activeUsersCount: 0,
returningUsersCount: 0,
churnedUsersCount: 0,
},
{
date: dayjs('2022-01-02'),
newUsersCount: 1,
activeUsersCount: 0,
returningUsersCount: 0,
churnedUsersCount: 0,
},
{
date: dayjs('2022-01-03'),
newUsersCount: 1,
activeUsersCount: 1, // user 1 (signup)
returningUsersCount: 0,
churnedUsersCount: 0,
},
{
date: dayjs('2022-01-04'),
newUsersCount: 0,
activeUsersCount: 1, // users 1 and 3 (user 2 purchased)
returningUsersCount: 0,
churnedUsersCount: 0,
},
{
date: dayjs('2022-01-05'),
newUsersCount: 0,
activeUsersCount: 2, // users 1, 2, and 4 (user 3 signed up)
returningUsersCount: 1, // user 2 (purchased)
churnedUsersCount: 0,
},
{
date: dayjs('2022-01-06'),
newUsersCount: 1,
activeUsersCount: 3, // users 1, 2, 4, and 3 (user 4 purchased)
returningUsersCount: 1, // user 3 (signed up)
churnedUsersCount: 0,
},
]);

// Restore the stubbed methods
stubFind.restore();
stubFindByQuery.restore();
stubAssociate.restore();
stubInclude.restore();
stubCount.restore();
});
});
