import * as React from 'react';
import { View, Text } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import * as Notifications from 'expo-notifications';

Notifications.setNotificationHandler({
handleNotification: async () => ({
shouldShowAlert: true,
shouldPlaySound: true,
shouldSetBadge: true,
}),
});

const PushNotificationsScreen = () => {
const [notification, setNotification] = React.useState(null);

useFocusEffect(React.useCallback(() => {
const subscription = Notifications.addNotificationReceivedListener((notification) => {
setNotification(notification);
});

return () => subscription.remove();
}, []));

return (
<View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
{notification && (
<>
<Text>{notification.request.content.body}</Text>
<Text>{JSON.stringify(notification.request)}</Text>
</>
)}
</View>
);
};

export default PushNotificationsScreen;
