import React from 'react';
import { View, Text } from 'react-native';
import { Notifications } from 'expo';

class PushNotifications extends React.Component {
constructor(props) {
super(props);
this.notificationReceived = this.notificationReceived.bind(this);
this.notificationOpened = this.notificationOpened.bind(this);
}

async componentDidMount() {
const { Notifications: expoNotifications } = Notifications;
await expoNotifications.setNotificationHandler({
handleNotification: async () => {
return expoNotifications.notificationResponseReceivedAsync();
},
});

const token = await expoNotifications.getExpoPushTokenAsync();
console.log(token);
}

notificationReceived(notification) {
console.log('Notification received: ', notification);
}

notificationOpened(notificationOpen) {
console.log('Notification opened: ', notificationOpen);
}

render() {
return (
<View>
<Text />
</View>
);
}
}

export default PushNotifications;
