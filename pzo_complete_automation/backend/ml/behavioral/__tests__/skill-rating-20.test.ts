import { Test, TestingModule } from '@nestjs/testing';
import { SkillRatingService } from './skill-rating.service';
import { SkillRatingController } from './skill-rating.controller';
import { UserRepository } from '../user/user.repository';
import { SkillRepository } from '../skill/skill.repository';
import { User } from '../user/entities/user.entity';
import { Skill } from '../skill/entities/skill.entity';
import { CreateUserDto } from '../user/dto/create-user.dto';
import { CreateSkillDto } from '../skill/dto/create-skill.dto';
import { getRepositoryToken } from '@nestjs/typeorm';

describe('SkillRatingController', () => {
let controller: SkillRatingController;
let service: SkillRatingService;
let userRepository: UserRepository;
let skillRepository: SkillRepository;

beforeEach(async () => {
const module: TestingModule = await Test.createTestingModule({
controllers: [SkillRatingController],
providers: [
SkillRatingService,
UserRepository,
SkillRepository,
{
provide: getRepositoryToken(User),
useValue: {},
},
{
provide: getRepositoryToken(Skill),
useValue: {},
},
],
}).compile();

controller = module.get<SkillRatingController>(SkillRatingController);
service = module.get<SkillRatingService>(SkillRatingService);
userRepository = module.get<UserRepository>(UserRepository);
skillRepository = module.get<SkillRepository>(SkillRepository);
});

it('should be defined', () => {
expect(controller).toBeDefined();
});

describe('rating', () => {
let user: User;
let skill1: Skill;
let skill2: Skill;

beforeEach(() => {
user = new User();
user.id = 1;

skill1 = new Skill();
skill1.id = 1;
skill1.name = 'Skill 1';

skill2 = new Skill();
skill2.id = 2;
skill2.name = 'Skill 2';
});

it('should calculate correct skill rating for one user', async () => {
// Arrange
userRepository.findOneBy = jest.fn().mockResolvedValue(user);
skillRepository.findAll = jest.fn().mockResolvedValue([skill1, skill2]);

const createUserDto: CreateUserDto = {
username: 'test',
password: 'password',
email: 'test@test.com',
};

await userRepository.save(createUserDto);

// Act
const result = await service.rating({ userId: user.id });

// Assert
expect(result).toEqual([
{ skillId: skill1.id, rating: 5 },
{ skillId: skill2.id, rating: 0 },
]);
});

it('should calculate correct skill rating for multiple users', async () => {
// Arrange
const user2 = new User();
user2.id = 2;

const createUserDto2: CreateUserDto = {
username: 'test2',
password: 'password2',
email: 'test2@test.com',
};

await userRepository.save(createUserDto);
await userRepository.save(createUserDto2);

skillRepository.findAll = jest.fn().mockResolvedValue([skill1, skill2]);

// Act
const result = await service.rating({ users: [user.id, user2.id] });

// Assert
expect(result).toEqual([
{ userId: user.id, skills: [{ skillId: skill1.id, rating: 5 }] },
{ userId: user2.id, skills: [{ skillId: skill1.id, rating: 0 }] },
]);
});
});

describe('personalizedRecommendations', () => {
let user: User;
let skill1: Skill;
let skill2: Skill;
let skill3: Skill;

beforeEach(() => {
user = new User();
user.id = 1;

skill1 = new Skill();
skill1.id = 1;
skill1.name = 'Skill 1';

skill2 = new Skill();
skill2.id = 2;
skill2.name = 'Skill 2';

skill3 = new Skill();
skill3.id = 3;
skill3.name = 'Skill 3';
});

it('should return personalized recommendations for one user', async () => {
// Arrange
userRepository.findOneBy = jest.fn().mockResolvedValue(user);
skillRepository.findAll = jest.fn().mockResolvedValue([skill1, skill2, skill3]);

const createUserDto: CreateUserDto = {
username: 'test',
password: 'password',
email: 'test@test.com',
};

await userRepository.save(createUserDto);

// Act
const result = await service.personalizedRecommendations({ userId: user.id });

// Assert
expect(result).toEqual([{ skillId: 3, recommendation: 'High' }]);
});

it('should return personalized recommendations for multiple users', async () => {
// Arrange
const user2 = new User();
user2.id = 2;

const createUserDto2: CreateUserDto = {
username: 'test2',
password: 'password2',
email: 'test2@test.com',
};

await userRepository.save(createUserDto);
await userRepository.save(createUserDto2);

skillRepository.findAll = jest.fn().mockResolvedValue([skill1, skill2, skill3]);

// Act
const result = await service.personalizedRecommendations({ users: [user.id, user2.id] });

// Assert
expect(result).toEqual([
{ userId: user.id, skills: [{ skillId: 3, recommendation: 'High' }] },
{ userId: user2.id, skills: [] },
]);
});
});
});
