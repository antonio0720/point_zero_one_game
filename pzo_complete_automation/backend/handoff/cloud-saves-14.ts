import * as firebase from 'firebase/app';
import 'firebase/auth';
import 'firebase/database';

const firebaseConfig = {
// Your Firebase configuration object
};

// Initialize Firebase app
firebase.initializeApp(firebaseConfig);

const auth = firebase.auth();
const database = firebase.database();

interface CloudSaveData {
userId: string;
saveKey: string;
data: any;
}

function getCloudSaveRef(userId: string, saveKey: string): firebase.database.Reference {
return database.ref(`cloud-saves/${userId}/${saveKey}`);
}

function createOrUpdateCloudSave(userId: string, saveKey: string, data: any) {
const cloudSaveRef = getCloudSaveRef(userId, saveKey);
return cloudSaveRef.set({ userId, saveKey, data }, (error) => {
if (error) console.error('Error creating or updating cloud save:', error);
});
}

function listenForHandoffSaves(userId: string, callback: (saveData: CloudSaveData) => void) {
const handoffRef = database.ref(`handoff/${userId}`);
handoffRef.on('child_changed', (snapshot) => {
const saveData = snapshot.val() as CloudSaveData;
callback(saveData);
});
}

function listenForCloudSaves(callback: (saveData: CloudSaveData[]) => void) {
const savesRef = database.ref(`cloud-saves`);
savesRef.on('value', (snapshot) => {
const data = snapshot.val() || {};
const saves: CloudSaveData[] = Object.entries(data).map(([key, value]) => ({ ...value, key }));
callback(saves);
});
}

function handleSavesSync({ localData, remoteData }: { localData: any; remoteData: any }) {
const savesToUpload = Object.entries(localData).filter(([_, value]) => !remoteData[value.saveKey]);
const savesToDownload = Object.entries(remoteData).filter(([_, value]) => !localData[value.saveKey]);

if (savesToUpload.length) {
savesToUpload.forEach(([userId, save]) => createOrUpdateCloudSave(userId, save.saveKey, save.data));
}

if (savesToDownload.length) {
savesToDownload.forEach(([_, save]) => listenForHandoffSaves(save.userId, (saveData) => {
if (saveData.saveKey === save.saveKey) {
const localSaveRef = getCloudSaveRef(saveData.userId, save.saveKey);
localSaveRef.on('value', (snapshot) => {
if (!snapshot.exists()) {
snapshot.ref.set(saveData);
}
});
}
}));
}
}

function syncSaves() {
const localData = {};
listenForCloudSaves((saves) => saves.forEach((save) => (localData[save.key] = save)));

let remoteData;
database.ref('.info/connected').on('value', (snapshot) => {
if (snapshot.val()) {
if (!remoteData) {
remoteData = {};
listenForSavesSync((saves) => saves.forEach((save) => (remoteData[save.key] = save)));
}
handleSavesSync({ localData, remoteData });
}
});
}

auth.onAuthStateChanged((user) => {
if (user) {
user.getIdToken(true).then((idToken) => {
// Use the idToken to sign in the Realtime Database
database.ref('.info/connected').onDisconnect().remove();
syncSaves();
listenForHandoffSaves(user.uid, (saveData) => {
const localSaveRef = getCloudSaveRef(user.uid, saveData.saveKey);
localSaveRef.on('value', (snapshot) => {
if (!snapshot.exists()) {
localSaveRef.set(saveData);
}
});
});
});
} else {
database.ref('.info/connected').remove();
}
});
