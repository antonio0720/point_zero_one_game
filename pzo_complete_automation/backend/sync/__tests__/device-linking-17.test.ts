import { Test, TestingModule } from '@nestjs/testing';
import { SyncService } from '../sync.service';
import { DeviceLinking17Controller } from './device-linking-17.controller';
import { Client, Transport, MessagePattern, Payload, RpcException } from '@nestjs/microservices';
import { CreateSessionDto } from '../dto/create-session.dto';
import { UpdateSessionDto } from '../dto/update-session.dto';
import { Session } from '../interfaces/session.interface';
import { expect } from 'chai';

describe('DeviceLinking17Controller', () => {
let syncService: SyncService;
let deviceLinking17Controller: DeviceLinking17Controller;
let client1: Client;
let client2: Client;

beforeAll(async () => {
const module: TestingModule = await Test.createTestingModule({
controllers: [DeviceLinking17Controller],
providers: [SyncService],
})
.overrideProvider(SyncService)
.useValue({
createSession: jest.fn(),
updateSession: jest.fn(),
})
.compile();

syncService = module.get<SyncService>(SyncService);
deviceLinking17Controller = module.get<DeviceLinking17Controller>(DeviceLinking17Controller);
client1 = client(new Transport('vmqps://localhost'));
client2 = client(new Transport('vmqps://localhost'));

client1.connect();
client2.connect();
});

afterAll(() => {
client1.close();
client2.close();
});

describe('multi-client sync', () => {
let session1: Session;
let session2: Session;

beforeEach(async () => {
session1 = await syncService.createSession({ clientId: 'client1' });
session2 = await syncService.createSession({ clientId: 'client2' });
});

it('should successfully create sessions for both clients', async () => {
expect(session1).to.not.be.null;
expect(session2).to.not.be.null;
});

it('should update session data and propagate changes between clients', async () => {
const updatedData = { key: 'value' };
await deviceLinking17Controller.updateSession(session1.id, updatedData);

const updatedSession = await syncService.getSessionById(session1.id);
expect(updatedSession.data).to.deep.equal(updatedData);

await deviceLinking17Controller.updateSession(session2.id, updatedData);
const finalUpdatedSession = await syncService.getSessionById(session2.id);
expect(finalUpdatedSession.data).to.deep.equal(updatedData);
});

it('should handle conflicts during session updates', async () => {
const conflictData = { key: 'value' };
await deviceLinking17Controller.updateSession(session1.id, conflictData);

try {
await deviceLinking17Controller.updateSession(session2.id, conflictData);
expect.fail('RpcException should have been thrown');
} catch (e) {
expect(e).to.be.instanceOf(RpcException);
}
});
});
});
