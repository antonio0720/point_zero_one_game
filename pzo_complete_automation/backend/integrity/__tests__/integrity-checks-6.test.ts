import { IntegrityService } from '../integrity.service';
import { getRepository } from 'typeorm';
import { IntegrityCheck } from '../entities/integrity-check.entity';
import { expect } from 'chai';
import sinon from 'sinon';
import { IntegrityCheckTypeEnum } from '../enums/integrity-check-type.enum';

describe('IntegrityService - integrity-checks-6', () => {
let service: IntegrityService;
let integrityRepositoryStub;

beforeEach(async () => {
integrityRepositoryStub = sinon.createStubInstance(getRepository(IntegrityCheck));
service = new IntegrityService(integrityRepositoryStub);
});

it('should perform integrity check 6 correctly', async () => {
const data = [ /* test data */ ];

integrityRepositoryStub
.createQueryBuilder('integrity_check')
.orderBy('id', 'DESC')
.setOptions({ take: 1 })
.getOne()
.resolves(data[0]);

sinon.stub(integrityRepositoryStub, 'save').resolves();

const result = await service.performIntegrityCheck(IntegrityCheckTypeEnum.INTEGRITY_CHECK_6);

expect(result).to.deep.equal(/* expected result */ );
});
});
