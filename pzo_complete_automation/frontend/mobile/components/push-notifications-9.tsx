import * as Notifications from 'expo-notifications';
import { Platform, Permissions } from 'react-native';

export const registerForPushNotificationsAsync = async () => {
let token;

if (Platform.OS === 'ios') {
const { status: permissionsStatus } = await Permissions.getAsync(
Permissions.NOTIFICATIONS
);
if (permissionsStatus !== 'granted') {
alert('Sorry, we need your notifications permission to make this work!');
return;
}

const tokenResult = await Notifications.getExpoPushTokenAsync();
token = tokenResult.data;
} else if (Platform.OS === 'android') {
const { status: permissionsStatus } = await Permissions.getAsync(
Permissions.NOTIFICATIONS
);
if (permissionsStatus !== 'granted') {
alert('Sorry, we need your notifications permission to make this work!');
return;
}

const tokenResult = await Notifications.getExpoPushTokenAsync({
projectId: "YOUR_EXPO_PROJECT_ID",
android: {
senderID: "SENDER_ID", // Sender ID from Firebase Cloud Messaging
},
});
token = tokenResult.data;
}

return token;
};

export const schedulePushNotification = async () => {
const notification = {
title: 'Hello From React Native!',
body: 'This is a test push notification!',
ios: {
sound: 'default', // You can choose a custom sound too
},
android: {
priority: 'high',
vibrate: true,
playSound: true,
},
};

await Notifications.scheduleNotificationAsync(notification);
};
