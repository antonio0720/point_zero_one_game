import { Test, TestingModule } from '@nestjs/testing';
import { ApiGatewayService } from './api-gateway.service';
import { ApiGatewayController } from './api-gateway.controller';
import { PrismaService } from '../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { createMock } from '@golevelup/nestjs-testing';

describe('ApiGatewayService', () => {
let service: ApiGatewayService;
let controller: ApiGatewayController;
let prismaService: PrismaService;
let jwtService: JwtService;

beforeEach(async () => {
const module: TestingModule = await Test.createTestingModule({
controllers: [ApiGatewayController],
providers: [
ApiGatewayService,
PrismaService,
JwtService,
{ provide: JwtService, useValue: createMock(JwtService) },
],
}).compile();

service = module.get<ApiGatewayService>(ApiGatewayService);
controller = module.get<ApiGatewayController>(ApiGatewayController);
prismaService = module.get<PrismaService>(PrismaService);
jwtService = module.get<JwtService>(JwtService);
});

// Add your test cases here
});
