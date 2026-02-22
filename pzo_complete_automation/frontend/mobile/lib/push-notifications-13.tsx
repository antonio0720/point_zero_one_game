import * as firebase from 'firebase';
import messaging, { RemoteMessage } from '@react-native-firebase/messaging';

const firebaseConfig = {
// Your Firebase project configuration here
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);

// Configure the Messaging instance with FCM server key and App ID
messaging().configure({
android_server_key: 'YOUR_FCM_SERVER_KEY',
fcm_web_config: {
sent_with_service_account: firebaseConfig,
},
});

// Request notifications permissions
messaging().requestPermission();

// Handle notification received event
messaging().onMessage((message: RemoteMessage) => {
console.log('Notification received:', message);
});

// Handle notification opened event
messaging().onNotificationOpenedApp(remoteMessage => {
console.log('Notification opened:', remoteMessage);
});
