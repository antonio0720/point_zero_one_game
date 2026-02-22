import { SessionManagementService } from '../session-management.service';
import { Injectable, forwardRef, inject } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { IdentityModule } from '../../identity.module';
import { getModelToken, MongooseModule } from '@nestjs/mongoose';
import { Session, SessionSchema } from '../entities/session.entity';
import { DeviceLinkingModule } from '../../device-linking/device-linking.module';
import { DeviceLinkingService } from '../../device-linking/device-linking.service';

describe('SessionManagementService (Identity lifecycle + recovery - session-management-6)', () => {
let service: SessionManagementService;
let deviceLinkingService: DeviceLinkingService;

beforeEach(async () => {
const module = await Test.createTestingModule({
imports: [
IdentityModule,
MongooseModule.forRoot(''),
DeviceLinkingModule,
],
providers: [
SessionManagementService,
{ provide: DeviceLinkingService, useClass: DeviceLinkingService },
],
})
.overrideProvider(getModelToken(Session.name))
.useValue(new SessionSchema())
.compile();

service = module.get<SessionManagementService>(SessionManagementService);
deviceLinkingService = module.get<DeviceLinkingService>(DeviceLinkingService);
});

// Add your test cases here
});
