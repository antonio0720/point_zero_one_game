import { Test, TestingModule } from '@nestjs/testing';
import { ReleaseChannelsService } from '../release-channels.service';
import { ReleaseChannelsController } from '../release-channels.controller';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';

describe('ReleaseChannels (e2e)', () => {
let releaseChannelsService: ReleaseChannelsService;
let releaseChannelsController: ReleaseChannelsController;
let jwtService: JwtService;

beforeAll(async () => {
const module: TestingModule = await Test.createTestingModule({
imports: [
ConfigModule.forRoot(),
JwtModule.registerAsync({
imports: [ConfigModule],
useFactory: (configService: ConfigService) => ({
secret: configService.get<string>('JWT_SECRET'),
}),
inject: [ConfigService],
}),
],
controllers: [ReleaseChannelsController],
providers: [ReleaseChannelsService, JwtService],
})
.overrideProvider(JwtService)
.useValue({ sign: jest.fn() })
.compile();

releaseChannelsService = module.get<ReleaseChannelsService>(ReleaseChannelsService);
releaseChannelsController = module.get<ReleaseChannelsController>(ReleaseChannelsController);
jwtService = module.get<JwtService>(JwtService);
});

describe('Release Channels', () => {
it('should return release channels', async () => {
// Add your test case implementation here.
});

// Add more test cases as needed
});
});
