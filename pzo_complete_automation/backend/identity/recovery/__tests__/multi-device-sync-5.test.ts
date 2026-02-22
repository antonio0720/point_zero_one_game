import { test, expect } from '@jest/globals';
import { createTestingClient, mockServer } from 'apollo-server-testing';
import { ApolloServer, gql } from 'apollo-server';
import { makeAugmentedSchema } from 'graphql-tools';
import resolvers from '../../resolvers';
import typeDefs from '../../typeDefs';
import IdentityService from '../../services/IdentityService';
import RecoveryService from '../../services/RecoveryService';
import DeviceService from '../../services/DeviceService';
import { createUser, generateEmailToken, generateResetPasswordToken } from '../factories';
import { RECOVERY_EMAIL, RESET_PASSWORD } from '../../graphql/mutations';
import { VERIFY_EMAIL, ACCEPT_RECOVERY, SET_NEW_PASSWORD } from '../../graphql/queries';

const server = new ApolloServer({
typeDefs,
resolvers,
});

const augmentedSchema = makeAugmentedSchema({
schema: server.schema,
directives: {
'cache-control': true,
},
});

let identityService;
let recoveryService;
let deviceService;
let mockData;

beforeAll(async () => {
await mockServer(server).start();

const client = createTestingClient(server);

identityService = new IdentityService(client);
recoveryService = new RecoveryService(client);
deviceService = new DeviceService(client);

// Prepare some data for testing
mockData = await Promise.all([
createUser({ email: 'test@example.com' }),
generateEmailToken('test@example.com'),
generateResetPasswordToken('test@example.com'),
]);
});

describe('Identity lifecycle + recovery - multi-device-sync-5', () => {
it('should be able to create a new user with multiple devices and recover password via email and reset token', async () => {
// Create a new user with two devices (device1 and device2)
const [user, device1, device2] = await Promise.all([
identityService.createUser('Test User'),
deviceService.registerDevice(user.id, 'device1', 'type1'),
deviceService.registerDevice(user.id, 'device2', 'type2'),
]);

// Send recovery email to the user's email
const { email } = mockData[0];
await recoveryService.sendRecoveryEmail(email);

// Verify email and get the recovery code
const { data } = await client.query({ query: VERIFY_EMAIL, variables: { email } });
const recoveryCode = data.verifyEmail.recoveryCode;

// Accept recovery request on device1 with an incorrect password (should fail)
await expect(
client.mutate({ mutation: ACCEPT_RECOVERY, variables: { recoveryCode, deviceId: device1.id } })
).rejects.toThrow('Incorrect password');

// Set a new password on device2 with the correct recovery code and password (should succeed)
await client.mutate({ mutation: SET_NEW_PASSWORD, variables: { recoveryCode, newPassword: 'newPassword' } });

// Check if the password was successfully updated for both devices
const userWithUpdatedPassword = await identityService.getUser(user.id);
expect(userWithUpdatedPassword.password).toBe('newPassword');
expect(device1.devices[0].enabled).toBe(false);
expect(device2.devices[0].enabled).toBe(true);
});
});
