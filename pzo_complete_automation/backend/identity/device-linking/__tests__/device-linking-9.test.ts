import { DeviceLinkingService } from '../device-linking.service';
import { of } from 'rxjs';
import { ActivatedRoute, Router } from '@angular/router';
import { MockActivatedRoute } from 'ng-mocks';
import { MockRouter } from 'ng-mocks';
import { DeviceLinkingCodes } from '../../constants/device-linking.codes';
import { DeviceLinkingServiceMock } from './device-linking.service.mock';

describe('Identity lifecycle + recovery - device-linking-9', () => {
let deviceLinkingService: DeviceLinkingService;
let activatedRoute: ActivatedRoute;
let router: Router;

beforeEach(() => {
activatedRoute = MockActivatedRoute.withParams({
linkToken: 'test-link-token'
});

router = MockRouter.withUrl('/');

deviceLinkingService = new DeviceLinkingServiceMock();
});

it('should redirect to recovery page when link token is invalid', () => {
const mockDeviceLinkingService = new DeviceLinkingServiceMock({
validateLinkToken: jasmine.createSpy().and.returnValue(of(false))
});

mockDeviceLinkingService.validateLinkToken.calls.reset();

(mockDeviceLinkingService as any).validateLinkToken.withArgs('test-link-token').returns(of(false));

const spyOnNavigate = spyOn(router, 'navigate');

mockDeviceLinkingService.linkDevice('test-link-token');

expect(spyOnNavigate).toHaveBeenCalledWith(['/recover'], { replaceUrl: true });
});

it('should link device and redirect to dashboard when link token is valid', () => {
const spyOnNavigate = spyOn(router, 'navigate');

deviceLinkingService.validateLinkToken = jasmine.createSpy().and.returnValue(of(true));
deviceLinkingService.linkDevice = jasmine.createSpy().and.returnValue(of(null));

activatedRoute.params = of({ linkToken: 'test-link-token' });

deviceLinkingService.validateLinkToken('test-link-token');
expect(deviceLinkingService.linkDevice).toHaveBeenCalledWith('test-link-token');

expect(spyOnNavigate).toHaveBeenCalledWith(['/dashboard'], { replaceUrl: true });
});

it('should show error message when failed to link device', () => {
const mockDeviceLinkingService = new DeviceLinkingServiceMock({
validateLinkToken: jasmine.createSpy().and.returnValue(of(true)),
linkDevice: jasmine.createSpy().and.returnValue(of(new Error('Test error')))
});

mockDeviceLinkingService.linkDevice.calls.reset();

(mockDeviceLinkingService as any).validateLinkToken.withArgs('test-link-token').returns(of(true));
(mockDeviceLinkingService as any).linkDevice.withArgs('test-link-token').returns(of(new Error('Test error')));

const spyOnError = spyOn(console, 'error');

mockDeviceLinkingService.linkDevice('test-link-token');

expect(spyOnError).toHaveBeenCalledWith(`Failed to link device: Test error`);
});
});
