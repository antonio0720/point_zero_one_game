import { AuditTrailService } from '../../services/audit-trail.service';
import { DatasetVersion } from '../../interfaces/dataset-version.interface';
import { of } from 'rxjs';

describe('Audit Trail Service', () => {
let auditTrailService: AuditTrailService;

beforeEach(() => {
auditTrailService = new AuditTrailService();
});

it('should log dataset version creation correctly', () => {
const datasetVersion: DatasetVersion = {
id: 'test-dataset-version-id',
datasetId: 'test-dataset-id',
version: 1,
createdAt: new Date(),
modifiedAt: null,
};

auditTrailService.logDatasetVersionCreation(datasetVersion).subscribe(() => {});

expect(console.log).toHaveBeenCalledWith(`Dataset version ${datasetVersion.version} of dataset ${datasetVersion.datasetId} created.`);
});

it('should log dataset version modification correctly', () => {
const datasetVersion: DatasetVersion = {
id: 'test-dataset-version-id',
datasetId: 'test-dataset-id',
version: 1,
createdAt: new Date(),
modifiedAt: null,
};

auditTrailService.logDatasetVersionModification(datasetVersion).subscribe(() => {});

expect(console.log).toHaveBeenCalledWith(`Dataset version ${datasetVersion.version} of dataset ${datasetVersion.datasetId} modified.`);
});

it('should return an observable of all dataset versions with correct audit log messages', () => {
const datasetVersions: DatasetVersion[] = [
{
id: 'test-dataset-version-1',
datasetId: 'test-dataset-id',
version: 1,
createdAt: new Date(),
modifiedAt: null,
},
{
id: 'test-dataset-version-2',
datasetId: 'test-dataset-id',
version: 2,
createdAt: new Date(),
modifiedAt: new Date(),
},
];

const auditLogMessages = [
`Dataset version 1 of dataset test-dataset-id created.`,
`Dataset version 2 of dataset test-dataset-id created.`,
`Dataset version 2 of dataset test-dataset-id modified.`,
];

jest.spyOn(console, 'log').mockImplementation(() => {});

const auditTrailServiceMock = jest.fn().mockReturnValue(of(datasetVersions));

auditTrailService = auditTrailServiceMock as any;

auditTrailService.getAuditLogMessagesForDatasetVersions(datasetVersions).subscribe((messages) => {
expect(messages).toEqual(auditLogMessages);
expect(console.log).toHaveBeenCalledWith(auditLogMessages[0]);
expect(console.log).toHaveBeenCalledWith(auditLogMessages[1]);
expect(console.log).toHaveBeenCalledWith(auditLogMessages[2]);
});
});
});
