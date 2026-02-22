import { Test, TestingModule } from '@nestjs/testing';
import { getConnectionToken, TypeOrmModule } from '@nestjs/typeorm';
import { AccountRecoveryService } from './account-recovery.service';
import { UserEntity } from '../user/entities/user.entity';
import { RecoverPasswordDto } from './dto/recover-password.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { AccountRecoveryRepository } from './account-recovery.repository';

describe('AccountRecoveryService', () => {
let service: AccountRecoveryService;
let accountRecoveryRepository: AccountRecoveryRepository;

beforeEach(async () => {
const module: TestingModule = await Test.createTestingModule({
imports: [TypeOrmModule.forRoot()],
providers: [
AccountRecoveryService,
AccountRecoveryRepository,
JwtAuthGuard,
{
provide: getConnectionToken(),
useValue: jest.createMockInstance(globalThis.connections[0]),
},
],
}).compile();

service = module.get<AccountRecoveryService>(AccountRecoveryService);
accountRecoveryRepository = module.get<AccountRecoveryRepository>(
AccountRecoveryRepository,
);
});

describe('recoverPassword', () => {
const user = new UserEntity();
const recoverPasswordDto: RecoverPasswordDto = {
email: 'test@example.com',
password: 'new_password',
};

it('should recover user password', async () => {
// Arrange
user.id = 1;
user.email = recoverPasswordDto.email;
jest.spyOn(accountRecoveryRepository, 'findOne').mockResolvedValue(null);
jest.spyOn(accountRecoveryRepository, 'create').mockReturnValue(user);
jest.spyOn(accountRecoveryRepository, 'save').mockResolvedValue(user);

// Act
await service.recoverPassword(recoverPasswordDto);

// Assert
expect(accountRecoveryRepository.findOne).toHaveBeenCalledWith({
where: { email: recoverPasswordDto.email },
});
expect(accountRecoveryRepository.create).toHaveBeenCalledWith(user);
expect(accountRecoveryRepository.save).toHaveBeenCalledWith(user);
});

it('should throw an error when user not found', async () => {
// Arrange
jest.spyOn(accountRecoveryRepository, 'findOne').mockResolvedValue(null);

// Act & Assert
await expect(service.recoverPassword(recoverPasswordDto)).rejects.toThrow();
});
});
});
