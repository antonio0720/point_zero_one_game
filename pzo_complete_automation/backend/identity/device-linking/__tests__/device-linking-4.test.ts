import { Test, TestingModule } from '@nestjs/testing';
import { DeviceLinkingService } from '../device-linking.service';
import { IdentityRepository } from '../../identity/repository/identity.repository';
import { DeviceRepository } from '../../identity/repository/device.repository';
import { RecoveryTokenRepository } from '../../identity/repository/recovery-token.repository';
import { DeviceLinkingController } from '../device-linking.controller';
import { IdentityService } from '../../identity/service/identity.service';
import { RecoveryTokenService } from '../../identity/service/recovery-token.service';
import * as jwt from 'jsonwebtoken';
import { JwtService } from '@nestjs/jwt';
import { NotFoundException } from '@nestjs/common';
import { CreateDeviceDto } from '../dto/create-device.dto';

describe('DeviceLinkingController (Identity lifecycle + recovery - device-linking-4)', () => {
let controller: DeviceLinkingController;
let service: DeviceLinkingService;
let identityRepository: IdentityRepository;
let deviceRepository: DeviceRepository;
let recoveryTokenRepository: RecoveryTokenRepository;
let identityService: IdentityService;
let recoveryTokenService: RecoveryTokenService;
let jwtSignMock: jest.Mock<jwt.SignOptions>;
let jwtVerifyMock: jest.Mock<any, any[]>;

beforeEach(async () => {
const module: TestingModule = await Test.createTestingModule({
controllers: [DeviceLinkingController],
providers: [
DeviceLinkingService,
IdentityRepository,
DeviceRepository,
RecoveryTokenRepository,
IdentityService,
RecoveryTokenService,
JwtService,
],
})
.overrideProvider(JwtService)
.useValue({
signAsync: jwtSignMock.mockResolvedValue('signedJwt'),
verifyAsync: jwtVerifyMock.mockImplementation((token: string) => Promise.resolve(true)),
})
.compile();

controller = module.get<DeviceLinkingController>(DeviceLinkingController);
service = module.get<DeviceLinkingService>(DeviceLinkingService);
identityRepository = module.get<IdentityRepository>(IdentityRepository);
deviceRepository = module.get<DeviceRepository>(DeviceRepository);
recoveryTokenRepository = module.get<RecoveryTokenRepository>(RecoveryTokenRepository);
identityService = module.get<IdentityService>(IdentityService);
recoveryTokenService = module.get<RecoveryTokenService>(RecoveryTokenService);
jwtSignMock = (module.get(JwtService) as any).signAsync as jest.Mock;
jwtVerifyMock = (module.get(JwtService) as any).verifyAsync;
});

describe('linkDevice', () => {
it('should link a device to an existing identity and return the updated device', async () => {
const identity = { id: '1' };
const device = { id: '2', identityId: null };
jwtSignMock.mockReturnValueOnce({ token: 'linkedJwt', signedJwt: 'linkedDevice' });

jest.spyOn(identityRepository, 'findOne').mockResolvedValue(identity);
jest.spyOn(deviceRepository, 'findOne').mockResolvedValue(device);
jest.spyOn(identityService, 'updateIdentity').mockResolvedValue(identity);

const linkedDevice = await controller.linkDevice({ identityId: '1', deviceToken: 'linkedJwt' } as CreateDeviceDto);

expect(linkedDevice).toEqual('linkedDevice');
expect(identityRepository.findOne).toHaveBeenCalledWith({ where: { id: '1' } });
expect(deviceRepository.findOne).toHaveBeenCalledWith({ where: { token: 'linkedJwt' } });
expect(identityService.updateIdentity).toHaveBeenCalledWith('1', { deviceId: '2' });
});

it('should return an error if the provided identity does not exist', async () => {
const identity = null;
jwtSignMock.mockReturnValueOnce({ token: 'linkedJwt', signedJwt: 'linkedDevice' });

jest.spyOn(identityRepository, 'findOne').mockResolvedValue(null);

await expect(controller.linkDevice({ identityId: 'nonExistentIdentity', deviceToken: 'linkedJwt' } as CreateDeviceDto)).rejects.toEqual(new NotFoundException('Identity not found'));
expect(identityRepository.findOne).toHaveBeenCalledWith({ where: { id: 'nonExistentIdentity' } });
});

it('should return an error if the provided device token is invalid', async () => {
const identity = { id: '1' };
jwtVerifyMock.mockImplementationOnce(() => Promise.reject(new Error()));

jest.spyOn(identityRepository, 'findOne').mockResolvedValue(identity);
jest.spyOn(deviceRepository, 'findOne').mockResolvedValue({ id: '2', identityId: null });

await expect(controller.linkDevice({ identityId: '1', deviceToken: 'invalidJwt' } as CreateDeviceDto)).rejects.toThrow('Invalid token');
expect(identityRepository.findOne).toHaveBeenCalledWith({ where: { id: '1' } });
expect(deviceRepository.findOne).toHaveBeenCalledWith({ where: { token: 'invalidJwt' } });
});
});

describe('recoverIdentity', () => {
it('should recover an identity and return the recovered identity details', async () => {
const recoveryToken = { id: '1', deviceId: '2', expiresAt: new Date() };
const device = { id: '2', identityId: null };
const identity = { id: '3' };
jwtSignMock.mockReturnValueOnce({ token: 'recoveredJwt', signedJwt: 'recoveredIdentity' });

jest.spyOn(recoveryTokenRepository, 'findOne').mockResolvedValue(recoveryToken);
jest.spyOn(deviceRepository, 'findOne').mockResolvedValue(device);
jest.spyOn(identityRepository, 'findOne').mockResolvedValue(null);
jest.spyOn(identityService, 'createIdentity').mockResolvedValue(identity);

const recoveredIdentity = await controller.recoverIdentity({ recoveryToken: 'recoveredJwt' } as any);

expect(recoveredIdentity).toEqual('recoveredIdentity');
expect(recoveryTokenRepository.findOne).toHaveBeenCalledWith({ where: { token: 'recoveredJwt' } });
expect(deviceRepository.findOne).toHaveBeenCalledWith({ where: { id: recoveryToken.deviceId } });
expect(identityRepository.findOne).toHaveBeenCalledWith({ where: { id: null } });
expect(identityService.createIdentity).toHaveBeenCalled();
});

it('should return an error if the provided recovery token does not exist', async () => {
const recoveryToken = null;

jest.spyOn(recoveryTokenRepository, 'findOne').mockResolvedValue(null);

await expect(controller.recoverIdentity({ recoveryToken: 'nonExistentRecoveryToken' } as any)).rejects.toEqual(new NotFoundException('Recovery token not found'));
expect(recoveryTokenRepository.findOne).toHaveBeenCalledWith({ where: { token: 'nonExistentRecoveryToken' } });
});

it('should return an error if the associated device does not exist', async () => {
const recoveryToken = { id: '1', deviceId: '2', expiresAt: new Date() };
const device = null;

jest.spyOn(recoveryTokenRepository, 'findOne').mockResolvedValue(recoveryToken);
jest.spyOn(deviceRepository, 'findOne').mockResolvedValue(null);

await expect(controller.recoverIdentity({ recoveryToken: 'recoveredJwt' } as any)).rejects.toEqual(new NotFoundException('Device not found'));
expect(recoveryTokenRepository.findOne).toHaveBeenCalledWith({ where: { token: 'recoveredJwt' } });
expect(deviceRepository.findOne).toHaveBeenCalledWith({ where: { id: recoveryToken.deviceId } });
});
});
});
