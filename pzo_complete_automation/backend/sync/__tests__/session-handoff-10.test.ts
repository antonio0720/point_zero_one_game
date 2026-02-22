import { Test, TestingModule } from '@nestjs/testing';
import { SyncService } from '../sync.service';
import { SessionHandoff10Handler } from './session-handoff-10.handler';
import { Client, CreateClientOptions, Transport } from '@nestjs/microservices';
import { ClientGrpc } from '@nestjs/microservices/grpc';
import { MockSyncService } from '../mocks/mock-sync.service';
import { createStubInstance } from 'jest-stubs';
import { SessionHandoff10HandlerArgs, SyncEvent } from '../interfaces';

describe('SessionHandoff10Handler', () => {
let syncService: SyncService;
let sessionHandoff10Handler: SessionHandoff10Handler;
let client1: ClientGrpc<any>;
let client2: ClientGrpc<any>;

beforeAll(async () => {
const module: TestingModule = await Test.createTestingModule({
providers: [
SyncService,
SessionHandoff10Handler,
{ provide: SyncService, useClass: MockSyncService },
],
}).compile();

syncService = module.get<SyncService>(SyncService);
sessionHandoff10Handler = module.get<SessionHandoff10Handler>(SessionHandoff10Handler);
client1 = client(new CreateClientOptions({
transport: Transport.GRPC,
options: {
url: 'grpc://localhost:50051',
package: 'sync',
serviceName: 'SyncService',
},
}));
client2 = client(new CreateClientOptions({
transport: Transport.GRPC,
options: {
url: 'grpc://localhost:50052',
package: 'sync',
serviceName: 'SyncService',
},
}));
});

it('should handle session handoff correctly', async () => {
const handlerArgs: SessionHandoff10HandlerArgs = {
syncService,
client1,
client2,
event: SyncEvent.UPDATE_USER,
data: { userId: '1' },
};
await sessionHandoff10Handler.execute(handlerArgs);

// Add more test cases for different events and data here...
});
});
