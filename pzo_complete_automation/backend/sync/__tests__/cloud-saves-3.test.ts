import { Test, TestingModule } from '@nestjs/testing';
import { CloudSavesService } from '../cloud-saves.service';
import { Client1Controller } from '../client1/client1.controller';
import { Client2Controller } from '../client2/client2.controller';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../../entity/user.entity';
import { CloudSave } from '../../entity/cloud-save.entity';
import { CreateUserDto } from '../../dto/create-user.dto';
import { CreateCloudSaveDto } from '../../dto/create-cloud-save.dto';

describe('Multi-client sync + handoff', () => {
let cloudSavesService: CloudSavesService;
let app: any;
let client1App: any;
let client2App: any;
let jwtService: JwtService;
let userRepository: Repository<User>;
let cloudSaveRepository: Repository<CloudSave>;

beforeAll(async () => {
const module: TestingModule = await Test.createTestingModule({
imports: [
JwtModule.registerAsync({
useValue: jwtService,
}),
],
controllers: [Client1Controller, Client2Controller],
providers: [CloudSavesService],
}).compile();

cloudSavesService = module.get<CloudSavesService>(CloudSavesService);
jwtService = module.get<JwtService>(JwtService);
userRepository = module.get<Repository<User>>(getRepositoryToken(User));
cloudSaveRepository = module.get<Repository<CloudSave>>(getRepositoryToken(CloudSave));

app = await module.createNestApplication();
client1App = await app.createMicroservice(Client1Controller);
client2App = await app.createMicroservice(Client2Controller);
});

it('should create a user and cloud save on client1', async () => {
// create a user with jwt token on client1
const user: CreateUserDto = {
username: 'testuser',
password: 'testpassword',
};
const createdUser = await userRepository.save(user);
const accessToken = jwtService.sign({ userId: createdUser.id });

// create a cloud save on client1
const cloudSave: CreateCloudSaveDto = {
data: 'test data',
};
const result = await cloudSavesService.create(createdUser.id, accessToken, cloudSave);
expect(result).toBeDefined();
});

it('should retrieve the cloud save on client1', async () => {
// retrieve the saved cloud save on client1
const result = await cloudSavesService.findOne(createdUser.id, accessToken);
expect(result).toEqual(expect.objectContaining({ data: 'test data' }));
});

it('should hand off the cloud save from client1 to client2', async () => {
// transfer the cloud save from client1 to client2
const result = await cloudSavesService.handoff(createdUser.id, accessToken);
expect(result).toBeDefined();
});

it('should retrieve the cloud save on client2', async () => {
// retrieve the transferred cloud save on client2
const result = await cloudSavesService.findOne(createdUser.id, accessToken);
expect(result).toEqual(expect.objectContaining({ data: 'test data' }));
});
});
