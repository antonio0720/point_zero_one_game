import { ProvenanceService } from '../provenance.service';
import { Version } from '../../entities/version.entity';
import { DataLineage } from '../../entities/data-lineage.entity';
import { getConnection, Repository } from 'typeorm';
import { createTestingConnections } from './utils/create-testing-connections';
import { closeTestingConnections } from './utils/close-testing-connections';
import { expect } from 'chai';

describe('ProvenanceService (e2e)', () => {
let connections: any[];
let provenanceService: ProvenanceService;
let versionRepository: Repository<Version>;
let lineageRepository: Repository<DataLineage>;

before(async () => {
connections = await createTestingConnections();
provenanceService = new ProvenanceService();
versionRepository = getConnection().getRepository(Version);
lineageRepository = getConnection().getRepository(DataLineage);
});

after(() => closeTestingConnections(connections));

describe('provenance-12', () => {
it('should create new version and update lineage with correct relationships', async () => {
// Given
const existingVersion = await versionRepository.save({ name: 'test-version-1' });
const existingLineage = await lineageRepository.save({
id: 1,
versionId: existingVersion.id,
parentId: null,
isRoot: true,
});

// When
const newVersion = await provenanceService.createNewVersion(existingVersion);

// Then
expect(newVersion).to.not.be.null;
expect(newVersion.name).to.equal('test-version-2');

const newLineage = await lineageRepository.findOne({ where: { versionId: newVersion.id } });
expect(newLineage).to.not.be.null;
expect(newLineage!.parentId).to.equal(existingVersion.id);
expect(newLineage!.versionId).to.equal(newVersion.id);
});
});
});
