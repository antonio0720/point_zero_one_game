import { FeatureFlagsService } from '../feature-flags.service';
import { LiveOpsControlPlaneClient } from '@nats-io/nats';
import { of } from 'rxjs';
import { FeatureFlag } from '../../interfaces/feature-flag.interface';

describe('LiveOps control plane - feature-flags-3', () => {
let featureFlagsService: FeatureFlagsService;
let liveOpsControlPlaneClientMock: Partial<LiveOpsControlPlaneClient>;

beforeEach(() => {
liveOpsControlPlaneClientMock = {
publish: jest.fn(),
// Add more mocked methods as needed
};

featureFlagsService = new FeatureFlagsService(liveOpsControlPlaneClientMock as LiveOpsControlPlaneClient);
});

it('should implement getFeatureFlag method', () => {
const mockFeatureFlag: FeatureFlag = {
name: 'mock-feature-flag',
enabled: true,
};

liveOpsControlPlaneClientMock.publish.mockReturnValue(
of({ data: JSON.stringify(mockFeatureFlag) })
);

featureFlagsService.getFeatureFlag('mock-feature-flag').subscribe((result) => {
expect(result).toEqual(mockFeatureFlag);
});
});

it('should implement toggleFeatureFlag method', () => {
const mockFeatureFlag: FeatureFlag = {
name: 'mock-feature-flag',
enabled: false,
};

liveOpsControlPlaneClientMock.publish.mockReturnValue(of({}));

featureFlagsService.toggleFeatureFlag('mock-feature-flag').subscribe(() => {
const expectedPublishData = JSON.stringify({ ...mockFeatureFlag, enabled: !mockFeatureFlag.enabled });
expect(liveOpsControlPlaneClientMock.publish).toHaveBeenCalledWith(expectedPublishData);
});
});
});
