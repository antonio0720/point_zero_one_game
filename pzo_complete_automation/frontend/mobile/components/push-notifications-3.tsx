import React, { useEffect } from 'react';
import { Notifications } from 'expo';
import messaging from '@react-native-firebase/messaging';

// Replace with your Firebase project configuration
const firebaseConfig = {
apiKey: "YOUR_API_KEY",
authDomain: "YOUR_AUTH_DOMAIN",
projectId: "YOUR_PROJECT_ID",
storageBucket: "YOUR_STORAGE_BUCKET",
messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
appId: "YOUR_APP_ID"
};

// Initialize Firebase
import firebase from 'firebase/app';
firebase.initializeApp(firebaseConfig);
const messagingInstance = messaging();

Notifications.setNotificationHandler({
handleNotification: async () => {
const additionalData = notification.data;
// Process your data here (if any)
return Notifications.presentLocalNotification({
title: 'New Notification',
body: additionalData.body,
});
},
});

messagingInstance.onNotificationOpenedApp((notification) => {
const { navigation } = this.props;
// Handle the notification opened app case
});

// Request permissions and subscribe to FCM topics
useEffect(() => {
async function requestUserPermissions() {
const authStatus = await messagingInstance.getAuthorizationStatus();
if (authStatus !== 'authorized') {
const permissionResponse = await messagingInstance.requestPermission();
if (permissionResponse === 'denied') {
console.log('Notification permissions denied.');
}
}
}

requestUserPermissions();

// Subscribe to a topic
const topic = 'your-topic';
messagingInstance.subscribeToTopic(topic);
}, []);
