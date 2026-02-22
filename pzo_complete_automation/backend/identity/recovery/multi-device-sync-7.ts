import * as admin from 'firebase-admin';
import { v4 } from 'uuid';

// Initialize Firebase Admin SDK
const serviceAccount = require('./path/to/serviceAccountKey.json');
admin.initializeApp({
credential: admin.credential.cert(serviceAccount),
});

const auth = admin.auth();
const db = admin.database();

interface UserData {
email: string;
deviceId?: string;
}

function generateDeviceId(userId: string): string {
return v4();
}

async function updateUserDevice(userId: string, deviceId: string) {
await db.ref(`users/${userId}`).set({ deviceId });
}

async function getOrCreateDeviceIdForUser(email: string): Promise<string> {
const userId = (await auth.lookupUserByEmail(email)).uid;
let userDataRef = db.ref(`users/${userId}`);

const dataSnapshot = await userDataRef.once('value');
const userData = dataSnapshot.val() as UserData | null;

if (!userData) {
const newDeviceId = generateDeviceId(userId);
await updateUserDevice(userId, newDeviceId);
return newDeviceId;
} else if (userData.deviceId) {
return userData.deviceId;
} else {
throw new Error('Unexpected user data');
}
}

export { getOrCreateDeviceIdForUser };
