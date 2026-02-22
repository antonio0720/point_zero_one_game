import * as Notifications from 'expo-notifications';
import { Pressable, Text } from 'react-native';
import { useState, useEffect } from 'react';

const PushNotifications6 = () => {
const [notification, setNotification] = useState(null);

useEffect(() => {
const subscription = Notifications.addNotificationReceivedListener((notification) => {
setNotification(notification);
});

return () => subscription.remove();
}, []);

const registerForPushNotificationsAsync = async () => {
let token;
try {
await Notifications.setExpoTokenAsync(token);
} catch (error) {
console.log(error);
}
};

return (
<Pressable onPress={registerForPushNotificationsAsync}>
<Text>Register for push notifications</Text>
</Pressable>
);
};

export default PushNotifications6;
