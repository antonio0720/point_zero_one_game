import * as admin from 'firebase-admin';
import { db } from './database';

const serviceAccount = require('./serviceAccountKey.json');

// Initialize the realtime database with the provided service account key
if (!admin.apps.length) {
admin.initializeApp({
credential: admin.credential.cert(serviceAccount),
databaseURL: 'https://your-project-id.firebaseio.com'
});
}

const ref = db.ref('users/user1'); // Replace with your user ID and path

interface UserData {
name?: string;
lastUpdated?: number;
}

class SyncHandler {
private data: UserData | null = null;

constructor(private initialValue: UserData) {
this.data = initialValue;
this.listen();
}

private listen() {
const onValue = (snapshot: any) => {
if (!snapshot.exists()) {
this.applyInitialState();
return;
}

this.updateData(snapshot.val());
};

const onChange = (errorObject: any) => {
console.log('The data changed', errorObject);
};

ref.on('value', onValue, onChange);
}

private applyInitialState() {
if (!this.data) return;

this.setData(this.data);
}

private setData(data: UserData) {
const updates = {};
updates[ref.key] = data;

ref.update(updates);
}

private updateData(data: UserData) {
if (!this.data || this.data.lastUpdated < data.lastUpdated) {
this.data = data;
this.setData(data);
}
}
}

const syncHandler = new SyncHandler({ name: 'User1' });
