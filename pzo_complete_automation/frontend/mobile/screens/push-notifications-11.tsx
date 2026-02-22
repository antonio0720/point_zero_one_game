import React from 'react';
import { View, Text } from 'react-native';
import { Notifications } from 'expo';

const PushNotifications11 = () => {
const notify = () => {
Notifications.notify({
title: 'New Notification',
body: 'This is a test notification.',
});
};

return (
<View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
<Text>Push Notifications Screen</Text>
<Button title="Send Push Notification" onPress={notify} />
</View>
);
};

export default PushNotifications11;
