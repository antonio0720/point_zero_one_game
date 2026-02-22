import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';
import { User } from '../entities/user.entity';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

describe('AuthService', () => {
let service: AuthService;
let jwtService: JwtService;
let usersService: UsersService;
let userRepository: Repository<User>;

beforeEach(async () => {
const module: TestingModule = await Test.createTestingModule({
providers: [AuthService, JwtService, UsersService, User],
overrides: [
{
provide: getRepositoryToken(User),
useValue: {},
},
],
}).compile();

service = module.get<AuthService>(AuthService);
jwtService = module.get<JwtService>(JwtService);
usersService = module.get<UsersService>(UsersService);
userRepository = module.get<Repository<User>>(getRepositoryToken(User));
});

it('should be defined', () => {
expect(service).toBeDefined();
});

describe('login', () => {
const mockUser = {}; // Mock user object

it('should return a JWT token', async () => {
jest.spyOn(usersService, 'findOne').mockResolvedValue(mockUser);
jest.spyOn(jwtService, 'sign).mockReturnValue('fake-jwt-token');

const result = await service.login(mockUser.username, mockUser.password);

expect(result).toEqual('fake-jwt-token');
});
});

// Add more test cases for other methods in AuthService (e.g., register)
});
