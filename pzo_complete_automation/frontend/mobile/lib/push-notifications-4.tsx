import * as firebase from 'firebase';
import messaging from '@react-native-firebase/messaging';

const firebaseConfig = {
// your firebase configuration object
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);

// Create a reference to the messaging service
const messagingInstance = messaging();

// Request permissions for push notifications
messagingInstance.requestPermission()
.then(() => {
console.log('Authorization status is granted.');
// Get the initial notification
messagingInstance.getInitialNotification()
.then((notification) => {
console.log(notification);
});

// Listen for incoming messages while app is in foreground
messagingInstance.onMessage((message) => {
console.log('Received a push message: ', message);
});
})
.catch((error) => {
console.log('Error has occurred.', error);
});
