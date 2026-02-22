import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { JwtService } from '@nestjs/jwt';
import { User } from '../user/entities/user.entity';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { AppModule } from '../app.module';

describe('AuthService', () => {
let authService: AuthService;
let jwtService: JwtService;
let userRepository: Repository<User>;
let app: INestApplication;

beforeAll(async () => {
const moduleFixture = await Test.createTestingModule({
imports: [AppModule],
})
.overrideProvider(JwtService)
.useValue({ sign: jest.fn(), verify: jest.fn() })
.compile();

authService = moduleFixture.get<AuthService>(AuthService);
jwtService = moduleFixture.get<JwtService>(JwtService);
userRepository = moduleFixture.get<Repository<User>>(getRepositoryToken(User));
app = moduleFixture.createNestApplication();
await app.init();
});

afterAll(async () => {
await app.close();
});

describe('login', () => {
const createUser = async () => {
// Your user creation logic here
};

it('should return a JWT when valid credentials are provided', async () => {
// Your test case for valid login
});

it('should not return a JWT when invalid credentials are provided', async () => {
// Your test case for invalid login
});
});

describe('register', () => {
it('should create a new user and return a JWT when valid registration data is provided', async () => {
// Your test case for successful registration
});

it('should not create a new user when invalid registration data is provided', async () => {
// Your test case for invalid registration
});
});
});
