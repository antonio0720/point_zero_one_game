import * as React from 'react';
import { View, Text } from 'react-native';
import { Notifications } from 'expo';

export default class PushNotifications12 extends React.Component {
constructor(props) {
super(props);
this.notificationReceived = this.notificationReceived.bind(this);
this.notificationOpened = this.notificationOpened.bind(this);

Notifications.setNotificationHandler({
handleNotification: async ( notification ) => {
return {
shouldShowAlert: true,
shouldPlaySound: true,
shouldSetBadge: false,
};
},
});
}

notificationReceived(notification) {
console.log("Push Notification Received:", notification);
}

notificationOpened(notificationOpen) {
console.log("Push Notification Opened:", notificationOpen);
}

async componentDidMount() {
const { expoPushToken } = await Notifications.getExpoPushTokenAsync();

console.log("Expo push token retrieved: ", expoPushToken);

this.registerForPushNotificationsAsync().then((token) =>
console.log({ expoPushToken: token })
);
}

async registerForPushNotificationsAsync() {
let token;

if (Platform.OS === 'android') {
const { GooglePlayServicesUtil } = require('react-native');
const status = await GooglePlayServicesUtil.isGooglePlayServicesAvailable();

if (status !== Configuration.SUCCESS) {
console.log("Google Play Services not available.");
return;
}

token = await Notifications.getExpoPushTokenAsync();
} else {
token = await Notifications.getExpoPushTokenAsync();
}

await Notifications.setExpoPushTokenAsync(token);

this.registerToRemoteNotifications();
}

async registerToRemoteNotifications() {
const { Notifications } = require('expo');

const token = await Notifications.getExpoPushTokenAsync();

const response = await fetch(`https://onesignal.com/api/v1/subscriptions`, {
method: 'POST',
headers: {
Accept: 'application/json',
'Content-Type': 'application/json',
},
body: JSON.stringify({
app_id: "YOUR_ONESIGNAL_APP_ID",
headers: {
'Authorization': "Basic YOUR_ONESIGNAL_REST_API_KEY",
},
device_tokens: [token],
}),
});

if (response.ok) {
console.log("Push Notification registration successful.");
} else {
console.error("Failed to register for push notifications.");
}
}

render() {
return (
<View>
<Text></Text>
</View>
);
}
}
