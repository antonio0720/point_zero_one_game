import messaging from '@react-native-firebase/messaging';

class NotificationService {
constructor() {}

async requestPermissions() {
const authStatus = await messaging().requestPermission();
return authStatus === messaging.AuthorizationStatus.AUTHORIZED;
}

async getToken() {
const fcmToken = await messaging().getToken();
console.log('FCM Token:', fcmToken);
return fcmToken;
}

async subscribeToTopic(topic: string) {
await messaging().subscribeToTopic(topic);
}

async unsubscribeFromTopic(topic: string) {
await messaging().unsubscribeFromTopic(topic);
}

async onMessageReceived(callback: (notification: any) => void) {
messaging().onMessage((notification) => {
callback(notification);
});
}

async onNotificationOpenedApp(callback: () => void) {
messaging().onNotificationOpenedApp(() => {
callback();
});
}
}

export default new NotificationService();
