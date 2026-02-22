import * as Notifications from 'expo-notifications';
import * as firebase from 'firebase';

// Initialize Firebase
const firebaseConfig = {
apiKey: "API_KEY",
authDomain: "AUTH_DOMAIN",
projectId: "PROJECT_ID",
storageBucket: "STORAGE_BUCKET",
messagingSenderId: "MESSAGING_SENDER_ID",
appId: "APP_ID"
};
firebase.initializeApp(firebaseConfig);
const messaging = firebase.messaging();

Notifications.setBadgeStyleAnnouncement("You have new notifications");

// Request permissions for push notifications
Notifications.requestPermissionsAsync().then((status) => {
if (status === Notifications.PermissionStatus.GRANTED) {
// Set a listener for incoming messages while the app is foregrounded
const foregroundSubscription = messaging.onMessage((message) => {
Notifications.scheduleNotificationAsync({
title: message.notification.title,
body: message.notification.body,
ios: {
sound: 'default', // default or custom sound
},
});
});

// Clean up the foreground subscription when app closes
return messaging.getToken().then((fcmToken) => {
console.log(fcmToken);
subscribeToTopic(fcmToken);
}).catch((error) => {
console.log(error);
});
}
});

// Subscribe to a topic on the device, e.g., 'my-topic'
const subscribeToTopic = (deviceToken: string) => {
messaging.subscribeToTopic('my-topic')
.then((response) => console.log("Subscribed to topic", response))
.catch((error) => console.log(error));
};
