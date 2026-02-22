import * as admin from 'firebase-admin';
import * as firebase from 'firebase/app';
import 'firebase/auth';

const serviceAccount = require('./path/to/serviceAccountKey.json');

// Initialize Firebase Admin SDK with your project's credentials
if (!firebase.apps.length) {
admin.initializeApp({
credential: admin.credential.cert(serviceAccount),
});
}
const auth = admin.auth();

async function createLinkingCode(userId: string): Promise<string> {
const linkingCode = await auth.generateRecoveryCode(userId, 10);
return linkingCode[0];
}

function verifyLinkingCode(userId: string, code: string): boolean {
return new Promise((resolve) => {
auth.verifyRecoveryCode(userId, code).then(() => resolve(true)).catch(() => resolve(false));
});
}
