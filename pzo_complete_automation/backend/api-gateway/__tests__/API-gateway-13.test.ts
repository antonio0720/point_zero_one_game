import { Test, TestingModule } from '@nestjs/testing';
import { ApiGatewayController } from './api-gateway.controller';
import { ApiGatewayService } from './api-gateway.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { getRepositoryToken } from '@nestjs/typeorm';
import { UserRepository } from '../users/user.repository';
import { User } from '../entities/user.entity';
import { CreateUserDto } from '../users/dtos/create-user.dto';

describe('ApiGatewayController (e2e)', () => {
let controller: ApiGatewayController;
let service: ApiGatewayService;
let userRepository: UserRepository;

beforeEach(async () => {
const module: TestingModule = await Test.createTestingModule({
controllers: [ApiGatewayController],
providers: [
ApiGatewayService,
JwtAuthGuard,
{ provide: getRepositoryToken(User), useValue: userRepository },
],
})
.overrideProvider(getRepositoryToken(User))
.useValue({
findOne: jest.fn(),
save: jest.fn(),
})
.compile();

controller = module.get<ApiGatewayController>(ApiGatewayController);
service = module.get<ApiGatewayService>(ApiGatewayService);
userRepository = module.get<UserRepository>(getRepositoryToken(User));
});

it('should be defined', () => {
expect(controller).toBeDefined();
expect(service).toBeDefined();
expect(userRepository).toBeDefined();
});

describe('createUser', () => {
const createUserDto: CreateUserDto = {
username: 'test_user',
email: 'test@example.com',
password: 'test1234',
};

it('should return a user when creating a new user', async () => {
// arrange
const user = new User();
user.username = createUserDto.username;
user.email = createUserDto.email;
user.password = createUserDto.password;

jest.spyOn(userRepository, 'save').resolves(user);

// act
const result = await service.createUser(createUserDto);

// assert
expect(result).toEqual(user);
expect(userRepository.save).toHaveBeenCalledTimes(1);
expect(userRepository.save).toHaveBeenCalledWith(user);
});
});
});
