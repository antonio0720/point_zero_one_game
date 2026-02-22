import React from 'react';
import { View, Text, Button } from 'react-native';
import { useNotificationEvents } from '@react-native-firebase/notifications';

const PushNotifications17 = () => {
const [notificationListeners, setNotificationListeners] = React.useState({});
const [notificationActions, setNotificationActions] = React.useState({});

const notificationListener = notification => {
console.log(notification);
};

const notificationActionReceived = (notification: any) => {
console.log(notification);
};

useNotificationEvents(
(notifType, payload) => {
if (notificationListeners[notifType]) {
notificationListeners[notifType](payload);
}
},
(notifAction) => {
if (notificationActions[notifAction.action.identifier]) {
notificationActions[notifAction.action.identifier]();
}
},
);

React.useEffect(() => {
setNotificationListeners({
onNotification: notificationListener,
});

setNotificationActions({
onAction: () => console.log('Notification action taken'),
});

return () => {
setNotificationListeners({});
setNotificationActions({});
};
}, []);

return (
<View>
<Text>Push Notifications Screen 17</Text>
<Button title="Open" onPress={() => console.log('Opened')} />
</View>
);
};

export default PushNotifications17;
