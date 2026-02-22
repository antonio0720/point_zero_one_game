import * as admin from 'firebase-admin';
import { DocumentReference, CollectionReference } from '@google-cloud/firestore';

const firebase = admin.initializeApp();
const auth = firebase.auth();
const db = firebase.firestore();

// User collection reference
const usersCollection: CollectionReference = db.collection('users');

// Device collection reference, using user UID as collection name
const devicesCollectionRef = (userId: string) => db.collection(userId);

// Generates a new recovery token for the given user
async function generateRecoveryToken(userId: string): Promise<string> {
const verificationId = await auth.currentUser?.sendEmailVerification();
return verificationId?.verificationId || '';
}

// Updates the user document with the provided recovery token
async function updateRecoveryToken(userId: string, recoveryToken: string): Promise<void> {
const userDocRef: DocumentReference = usersCollection.doc(userId);
await userDocRef.update({ recoveryToken });
}

// Checks if a recovery token is valid for the given user
async function isValidRecoveryToken(userId: string, recoveryToken: string): Promise<boolean> {
const userDocRef: DocumentReference = usersCollection.doc(userId);
const userSnapshot = await userDocRef.get();
return userSnapshot.exists && userSnapshot.data()?.recoveryToken === recoveryToken;
}

// Associates the given device with the provided user
async function associateDevice(userId: string, deviceId: string): Promise<void> {
const devicesCollection = devicesCollectionRef(userId);
await devicesCollection.doc(deviceId).set({
createdAt: new Date(),
lastUsedAt: new Date(),
});
}

// Disassociates the given device from the provided user
async function disassociateDevice(userId: string, deviceId: string): Promise<void> {
const devicesCollection = devicesCollectionRef(userId);
await devicesCollection.doc(deviceId).delete();
}

// Checks if the given device is associated with the provided user
async function isDeviceAssociated(userId: string, deviceId: string): Promise<boolean> {
const devicesCollection = devicesCollectionRef(userId);
const deviceSnapshot = await devicesCollection.doc(deviceId).get();
return deviceSnapshot.exists;
}
