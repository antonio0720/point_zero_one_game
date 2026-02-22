import messaging from '@react-native-firebase/messaging';

messaging().onNotificationOpenedApp((notification) => {
console.log('Notification opened:', notification);
});

messaging().getInitialNotification()
.then((notification) => {
if (notification) {
console.log('Initial Notification:', notification);
}
messaging().onNotification(notification => {
console.log('Received Notification:', notification);
});
});

messaging().getToken()
.then((token) => {
console.log('Push token:', token);
})
.catch((error) => {
console.log('Error getting push token.', error);
});
