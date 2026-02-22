import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from '../auth.service';
import { JwtService } from '@nestjs/jwt';
import { User } from '../../user/entities/user.entity';
import { UsersService } from '../../user/users.service';
import { BadRequestException, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { getRepositoryToken, Repository } from '@nestjs/typeorm';
import { UserRepository } from '../../user/repositories/user.repository';
import { sign } from 'jsonwebtoken';

describe('AuthService', () => {
let authService: AuthService;
let usersService: UsersService;
let userRepository: Repository<User>;
let jwtService: JwtService;

beforeEach(async () => {
const module: TestingModule = await Test.createTestingModule({
providers: [AuthService, UsersService, JwtService, UserRepository],
})
.overrideProvider(UserRepository)
.useValue({
// mock user repository methods
})
.compile();

authService = module.get<AuthService>(AuthService);
usersService = module.get<UsersService>(UsersService);
jwtService = module.get<JwtService>(JwtService);
userRepository = module.get(getRepositoryToken(UserRepository));
});

describe('login', () => {
const mockUser: User = new User();
// ... test cases for login method
});

describe('register', () => {
const mockUser: User = new User();
// ... test cases for register method
});

describe('validateUser', () => {
// ... test cases for validateUser method
});
});
