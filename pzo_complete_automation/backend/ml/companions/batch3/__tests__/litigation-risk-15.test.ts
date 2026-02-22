import { LitigationRisk15 } from '../models/litigation-risk-15';
import { model, Schema, Document } from 'mongoose';
import { IMock, Mock, It.isAny } from 'ts-mockito';
import { DatabaseService } from '../../services/database/database.service';

describe('LitigationRisk15', () => {
let litigationRisk15Model: any;
let dbServiceMock: IMock<DatabaseService>;

beforeAll(() => {
dbServiceMock = Mock.ofType(DatabaseService);
litigationRisk15Model = model('LitigationRisk15', new Schema({}));
});

describe('save', () => {
it('should save a LitigationRisk15 instance to the database', async () => {
const litigationRiskInstance: Partial<LitigationRisk15> = {};
const expectedDatabaseSaveSpy = dbServiceMock.expects('saveToDatabase').once();
dbServiceMock.setup().saveToDatabase.returns(Promise.resolve());

await LitigationRisk15.create(litigationRiskInstance as any);

expect(expectedDatabaseSaveSpy).toHaveBeenCalledWith(It.isA(Document), litigationRiskInstance);
});
});

describe('findOne', () => {
it('should find a LitigationRisk15 instance from the database by id', async () => {
const litigationRiskId = 'some-id';
const expectedDatabaseFindByIdSpy = dbServiceMock.expects('findOneByID').once();
dbServiceMock.setup().findOneByID.returns(Promise.resolve({} as any));

const result = await LitigationRisk15.findOne(litigationRiskId);

expect(expectedDatabaseFindByIdSpy).toHaveBeenCalledWith('LitigationRisk15', litigationRiskId);
expect(result).toEqual({});
});
});
});
