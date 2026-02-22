import { Provenance } from '../provenance';
import { DatasetVersion } from '../../dataset/version';
import { Lineage } from '../../lineage';

jest.mock('../../dataset/version');
jest.mock('../../lineage');

describe('Provenance', () => {
describe('create', () => {
it('should create a new provenance object with an initial version and empty lineage', () => {
const createSpy = jest.spyOn(Provenance, 'create');
DatasetVersion.mockReturnValue({ id: 'v1' });
Lineage.mockReturnValue([]);

const provenance = Provenance.create();

expect(createSpy).toHaveBeenCalledTimes(1);
expect(provenance).toEqual(expect.objectContaining({ version: { id: 'v1' }, lineage: [] }));
});
});

describe('updateVersion', () => {
it('should update the provenance version with a new dataset version and append it to the lineage', () => {
const provenance = Provenance.create();
const newDatasetVersion = { id: 'v2' };
const newLineageElement = { id: 'v1', previousVersionId: undefined };

Lineage.mockReturnValue([newLineageElement]);
DatasetVersion.mockReturnValue(newDatasetVersion);

Provenance.updateVersion(provenance, newDatasetVersion);

expect(provenance.version).toEqual({ id: 'v2', previousVersionId: 'v1' });
expect(provenance.lineage).toEqual([newLineageElement]);
});
});
});
