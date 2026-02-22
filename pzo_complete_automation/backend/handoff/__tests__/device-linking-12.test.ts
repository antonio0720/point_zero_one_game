import { Client, HandoffClient } from '../../../src/client';
import { DeviceLinkingService } from '../../../src/services/device-linking-service';
import { SyncService } from '../../../src/services/sync-service';
import { HandoffService } from '../../../src/services/handoff-service';
import { User } from '../../../src/models/user';
import { Device } from '../../../src/models/device';
import { DataStore } from '../../../src/data-store';
import { TestHelper } from '../../test-helper';

describe('Multi-client sync + handoff - device-linking-12', () => {
let testHelper: TestHelper;
let user1: User;
let user2: User;
let device1: Device;
let device2: Device;

beforeAll(async () => {
testHelper = new TestHelper();
await testHelper.initialize();
user1 = await testHelper.createUser('user1@example.com', 'password1');
user2 = await testHelper.createUser('user2@example.com', 'password2');
device1 = await testHelper.createDevice(user1);
device2 = await testHelper.createDevice(user2);
});

afterAll(async () => {
await testHelper.cleanup();
});

it('should link devices and perform sync', async () => {
const client1 = new Client(user1, device1, new DataStore());
const client2 = new HandoffClient(user2, device2, new DataStore(), client1);

await DeviceLinkingService.linkDevices(client1, client2);

// Check that both clients have the same data after sync
const syncService1 = new SyncService(client1.dataStore);
const syncService2 = new SyncService(client2.dataStore);

await syncService1.sync();
await syncService2.sync();

expect(client1.dataStore.getAllData()).toEqual(client2.dataStore.getAllData());
});

it('should handle device unlink and perform sync', async () => {
const client1 = new Client(user1, device1, new DataStore());
const client2 = new HandoffClient(user2, device2, new DataStore(), client1);

await DeviceLinkingService.linkDevices(client1, client2);

// Unlink devices and check that both clients have different data after sync
await DeviceLinkingService.unlinkDevices(client1, client2);

const syncService1 = new SyncService(client1.dataStore);
const syncService2 = new SyncService(client2.dataStore);

await syncService1.sync();
await syncService2.sync();

expect(client1.dataStore.getAllData()).not.toEqual(client2.dataStore.getAllData());
});
});
