import { Test, TestingModule } from '@nestjs/testing';
import { IdentityService } from '../identity.service';
import { getModelToken, MongooseModule } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from '../schemas/user.schema';

describe('IdentityService', () => {
let service: IdentityService;
let userModel: Model<UserDocument>;

beforeEach(async () => {
const module: TestingModule = await Test.createTestingModule({
imports: [
MongooseModule.forRoot('mongodb://localhost/nest'),
MongooseModule.forFeature([{ name: User.name, schema: User.schema }]),
],
providers: [IdentityService],
}).compile();

service = module.get<IdentityService>(IdentityService);
userModel = module.get<Model<UserDocument>>(getModelToken(User.name));
});

describe('register', () => {
it('should create a new user', async () => {
// Your test code here
});
});

describe('login', () => {
it('should return user if correct credentials', async () => {
// Your test code here
});
});

// Add more test cases as needed for the methods in your IdentityService
});
