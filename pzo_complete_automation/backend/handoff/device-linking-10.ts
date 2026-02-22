import * as admin from 'firebase-admin';
import { DocumentReference, collection, addDoc, updateDoc, query, where } from '@firebase/firestore';

const firebaseAdmin = () => {
if (!admin.apps.length) {
admin.initializeApp({
credential: admin.credential.cert({
// Add your service account key here
}),
});
}
};

interface DeviceLinkingData {
deviceId?: string;
clientId?: string;
}

const devicesCollection = collection(admin.firestore(), 'device_linking');

function createDeviceLinkingRecord(clientId: string, deviceId: string): Promise<DocumentReference> {
firebaseAdmin();
const deviceData: DeviceLinkingData = { clientId, deviceId };
return addDoc(devicesCollection, deviceData);
}

async function updateDeviceLinkingRecord(deviceId: string, newClientId: string): Promise<void> {
firebaseAdmin();

const q = query(devicesCollection, where('deviceId', '==', deviceId));
const deviceSnapshot = await admin.firestore().runTransactionAsync((transaction) => {
return transaction.get(q.limit(1)).then((querySnap) => {
if (querySnap.empty) {
throw new Error('Device not found');
}
const deviceRef = querySnap.docs[0];
transaction.update(deviceRef, { clientId: newClientId });
});
});
}

async function getCurrentClientForDevice(deviceId: string): Promise<string | null> {
firebaseAdmin();

const q = query(devicesCollection, where('deviceId', '==', deviceId));
const deviceSnapshot = await admin.firestore().runTransactionAsync((transaction) => {
return transaction.get(q.limit(1)).then((querySnap) => {
if (querySnap.empty) {
return null;
}
return querySnap.docs[0].data()?.clientId;
});
});

return deviceSnapshot;
}
