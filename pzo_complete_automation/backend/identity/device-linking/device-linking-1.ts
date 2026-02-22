import * as admin from 'firebase-admin';
import * as firebase from 'firebase/app';
import { FirebaseDynamicLinks } from 'firebase-admin/lib/utils/dynamiclinks';

const serviceAccount = require('./path/to/service-account-key.json');

// Initialize the app with a custom app name for easier debugging
firebase.initializeApp({
credential: admin.credential.cert(serviceAccount),
name: 'DeviceLinking',
}, 'device-linking');

const db = admin.firestore();

function generateDynamicLink(userId: string, deepLink: string): Promise<string> {
const links = new FirebaseDynamicLinks(admin);

return links.dynamicLink({
domainUriPrefix: 'your-firebase-project-id.page.link',
link: deepLink,
android: {
packageName: 'com.your-app-id',
minimumVersion: '',
},
ios: {
bundleId: 'com.your-app-id',
appStoreId: 'your-team-id',
},
dynamicLinkPath: `/link/${userId}`,
}).then((url) => url.toString());
}

function verifyAndUpdateDeviceLink(verificationCode: string, userId: string): Promise<boolean> {
return db.collection('users').doc(userId).get().then((userDoc) => {
if (!userDoc.exists) {
return false;
}

const userData = userDoc.data();
const savedVerificationCode = userData.verificationCode;

// Compare the verification codes and update the user document
if (savedVerificationCode === verificationCode) {
db.collection('users').doc(userId).update({ verificationCode: null });
return true;
} else {
return false;
}
});
}

// Example usage
generateDynamicLink('user123', 'your-deep-link-here')
.then((dynamicLink) => {
// Send the dynamic link to the user via email or another method
console.log(dynamicLink);
})
.catch((error) => {
console.error(error);
});
