import { AllowlistService } from '../../services/allowlist.service';
import { IAllowlistService } from '../../interfaces/IAllowlistService';
import { IAllowlistItem } from '../../interfaces/IAllowlistItem';
import { DataGovernanceService } from '../../services/data-governance.service';
import { IDatagovClient } from '../../interfaces/IDatagovClient';
import { Client, Stub } from 'aws-sdk-stub';

jest.mock('../../services/allowlist.service');
jest.mock('../../services/data-governance.service');

describe('AllowlistService', () => {
const allowlistServiceMock = new Stub(AllowlistService) as IAllowlistService;
const dataGovernanceServiceMock = new Stub(DataGovernanceService) as IDatagovClient;

beforeEach(() => {
allowlistServiceMock.createOrUpdate.mockReset();
allowlistServiceMock.delete.mockReset();
dataGovernanceServiceMock.getAllowlists.mockResolvedValue([]);
});

it('should create or update an allowlist item', async () => {
// Arrange
const createOrUpdateSpy = jest.spyOn(allowlistServiceMock, 'createOrUpdate');
const item: IAllowlistItem = { /* your item */ };

// Act
await allowlistServiceMock.createOrUpdate(item);

// Assert
expect(createOrUpdateSpy).toHaveBeenCalledWith(item);
});

it('should delete an allowlist item', async () => {
// Arrange
const deleteSpy = jest.spyOn(allowlistServiceMock, 'delete');
const itemId: string = 'test-id';

// Act
await allowlistServiceMock.delete(itemId);

// Assert
expect(deleteSpy).toHaveBeenCalledWith(itemId);
});

it('should fetch allowlists from Data Governance service', async () => {
// Arrange
const getAllowlistsSpy = jest.spyOn(dataGovernanceServiceMock, 'getAllowlists');

// Act
await allowlistServiceMock.fetchAllowlists();

// Assert
expect(getAllowlistsSpy).toHaveBeenCalled();
});
});
