import * as Notifications from 'expo-notifications';
import { Pressable, Text } from 'react-native';

Notifications.setNotificationHandler({
handleNotification: async () => ({
shouldShowAlert: true,
sound: true,
}),
});

const notification = async () => {
await Notifications.scheduleNotificationAsync({
content: {
title: 'New Message',
body: 'You have a new message.',
},
trigger: {
seconds: 30,
},
});
};

const App = () => {
return (
<Pressable onPress={notification}>
<Text>Schedule Notification</Text>
</Pressable>
);
};

export default App;
