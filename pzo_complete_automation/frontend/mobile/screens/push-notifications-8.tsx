import * as Notifications from 'expo-notifications';

Notifications.setNotificationHandler({
handleNotification: async () => ({
shouldShowAlert: true,
sound: true,
vibrate: [0, 250, 250],
}),
});

const registerForPushNotificationsAsync = async () => {
let token;
try {
const { status } = await Notifications.requestPermissionsAsync();
if (status === 'granted') {
const tokenData = await Notifications.getExpoPushTokenAsync();
token = tokenData.data;
}
} catch (error) {
console.log(error);
}

return token;
};

const schedulePushNotification = async () => {
const token = await registerForPushNotificationsAsync();

if (token) {
await Notifications.scheduleNotificationAsync({
content: { title: 'Hello from Expo!', body: 'This is a test notification!' },
trigger: { seconds: 20 },
});
}
};

// call schedulePushNotification whenever you want to send a push notification
