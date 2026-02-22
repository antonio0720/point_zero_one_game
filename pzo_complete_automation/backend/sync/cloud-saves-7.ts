import * as firebase from 'firebase/app';
import 'firebase/firestore';
import 'firebase/storage';

const firebaseConfig = {
// your Firebase configuration goes here
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const storage = firebase.storage();

// Sync data across multiple clients (real-time updates)
function syncData<T>(collection: string, docId?: string): Promise<T | null> {
const ref = docId ? db.doc(`${collection}/${docId}`) : db.collection(collection);
const unsubscribe = ref.onSnapshot((snapshot) => {
if (snapshot.exists) {
return snapshot.data() as T;
}
return null;
});

// When a new client joins or an existing one reconnects, subscribe to data updates.
unsubscribe.then((prevData: T | null) => {
if (!prevData) {
ref.get().then((docSnapshot) => {
if (docSnapshot.exists) {
docSnapshot.data() as T;
}
});
}
});

return new Promise<T | null>((resolve) => {
unsubscribe.then(resolve);
});
}

// Handoff data between clients (when a client disconnects or a new one connects)
function handoffData<T>(collection: string, docId?: string): Promise<T | null> {
const ref = docId ? db.doc(`${collection}/${docId}`) : db.collection(collection);

// Listen for changes and resolve with the current data when a change is detected.
return new Promise((resolve) => {
const unsubscribe = ref.onSnapshot(() => {
unsubscribe();
resolve(ref.get().data() as T);
});
});
}

// Upload and download files to/from Firebase Storage
async function uploadFile(bucketName: string, filePath: string, destinationRef: firebase.storage.Reference) {
const file = await fs.promises.readFile(filePath);
await destinationRef.put(file);
}

async function downloadFile(bucketName: string, fileRef: firebase.storage.Reference, filePath: string): Promise<void> {
const response = await fileRef.getDownloadURL();
const fileStream = fs.createWriteStream(filePath);

await fetch(response)
.then((res) => res.body.pipeTo(fileStream))
.catch((err) => console.error(err));
}
