import { Test, TestingModule } from '@nestjs/testing';
import { DeviceLinkingService } from '../device-linking.service';
import { DeviceLinkingController } from '../device-linking.controller';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../../users/users.service';
import { SessionsService } from '../../sessions/sessions.service';
import { ConfigService } from '@nestjs/config';

describe('DeviceLinkingController (Multi-client sync + handoff - device-linking-2)', () => {
let controller: DeviceLinkingController;
let service: DeviceLinkingService;
let jwtService: JwtService;
let usersService: UsersService;
let sessionsService: SessionsService;
let configService: ConfigService;

beforeEach(async () => {
const module: TestingModule = await Test.createTestingModule({
controllers: [DeviceLinkingController],
providers: [
DeviceLinkingService,
JwtService,
UsersService,
SessionsService,
ConfigService,
],
})
.overrideProvider(JwtService)
.useValue({ sign: jest.fn(), verify: jest.fn() })
.compile();

controller = module.get<DeviceLinkingController>(DeviceLinkingController);
service = module.get<DeviceLinkingService>(DeviceLinkingService);
jwtService = module.get<JwtService>(JwtService);
usersService = module.get<UsersService>(UsersService);
sessionsService = module.get<SessionsService>(SessionsService);
configService = module.get<ConfigService>(ConfigService);
});

// Add your test cases here
});
