import firebase from 'firebase/app';
import 'firebase/firestore';
import 'firebase/storage';

const firebaseConfig = {
// Your firebase config object here
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);

const database = firebase.firestore();
const storage = firebase.storage();

class CloudSavesService {
saveData(userId: string, data: any) {
const userRef = database.doc(`users/${userId}`);
userRef.set(data, { merge: true });
}

async loadData(userId: string) {
const userDoc = await database.doc(`users/${userId}`).get();
if (userDoc.exists) {
return userDoc.data();
} else {
console.error('No data found for user:', userId);
return null;
}
}

async uploadFile(userId: string, file: File, fileName: string) {
const storageRef = storage.ref(`users/${userId}/${fileName}`);
await storageRef.put(file);
console.log('Uploaded file:', fileName);
}

async downloadFile(userId: string, fileName: string) {
const storageRef = storage.ref(`users/${userId}/${fileName}`);
const urlSnapshot = await storageRef.getDownloadURL();
return urlSnapshot.toString();
}
}

export default CloudSavesService;
