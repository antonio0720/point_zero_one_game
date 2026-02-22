import React from 'react';
import { Notifications } from 'expo';
import * as Permissions from 'expo-permissions';
import NetInfo from "@react-native-community/netinfo";

Notifications.createChannelAsync(
'default',
{
name: 'default',
importance: Notifications.AndroidImportance.DEFAULT,
vibrate: true,
lightColor: '#FF233F4B',
sound: true
},
);

async function registerForPushNotificationsAsync() {
const { status: existingStatus } = await Permissions.getAsync(
Permissions.NOTIFICATIONS,
);
let finalStatus = existingStatus;
if (existingStatus !== 'granted') {
const { status } = await Permissions.askAsync(
Permissions.NOTIFICATIONS,
);
finalStatus = status;
}

if (finalStatus !== 'granted') {
alert('Failed to get push token for push notification!');
return;
}

const token = (await Notifications.getExpoPushTokenAsync()).data;
console.log(token);

NetInfo.fetch().then((state) => {
if (state.isConnected) {
registerFCMWithServer(token);
} else {
alert('No internet connection');
}
});
}

function registerFCMWithServer(expoPushToken) {
const serverURL = 'https://yourserverurl.com/fcm'; // Replace with your backend server URL that handles FCM registration

return fetch(serverURL, {
method: 'POST',
headers: {
Accept: 'application/json',
'Content-Type': 'application/json',
},
body: JSON.stringify({ expoPushToken }),
})
.then((response) => response.json())
.then((result) => console.log(result))
.catch((error) => console.log('Error:', error));
}

Notifications.addNotificationReceivedListener((notification) => {
console.log(
'Notification:',
notification,
);
});

Notifications.addNotificationResponseReceivedListener((response) => {
console.log(
'Notification response:',
response,
);
});

export default function App() {
registerForPushNotificationsAsync();

return null;
}
