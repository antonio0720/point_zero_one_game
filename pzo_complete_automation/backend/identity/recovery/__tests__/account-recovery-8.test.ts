import { Test, TestingModule } from '@nestjs/testing';
import { IdentityService } from '../identity.service';
import { AccountRecoveryService } from './account-recovery.service';
import { UserEntity } from '../../user/entities/user.entity';
import { getRepositoryToken } from '@nestjs/typeorm';
import { JwtService } from '@nestjs/jwt';
import { CreateRecoveryDto, RecoveryStatus } from './dto/create-recovery.dto';
import { RecoveryEntity } from './entities/recovery.entity';

describe('AccountRecoveryService', () => {
let service: AccountRecoveryService;
let identityService: IdentityService;
let userRepository: typeof UserEntity;
let recoveryRepository: typeof RecoveryEntity;
let jwtService: JwtService;

beforeEach(async () => {
const module: TestingModule = await Test.createTestingModule({
providers: [
AccountRecoveryService,
IdentityService,
{ provide: getRepositoryToken(UserEntity), useValue: userRepository },
{ provide: getRepositoryToken(RecoveryEntity), useValue: recoveryRepository },
{ provide: JwtService, useValue: jwtService },
],
}).compile();

service = module.get<AccountRecoveryService>(AccountRecoveryService);
identityService = module.get<IdentityService>(IdentityService);
userRepository = module.get(getRepositoryToken(UserEntity));
recoveryRepository = module.get(getRepositoryToken(RecoveryEntity));
jwtService = module.get<JwtService>(JwtService);
});

it('should be defined', () => {
expect(service).toBeDefined();
});

// Add your test cases here
});
