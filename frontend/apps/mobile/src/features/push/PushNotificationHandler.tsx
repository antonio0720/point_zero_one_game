/**
 * PushNotificationHandler.tsx
 *
 * Handles push notifications for the mobile application.
 */

import React, { useEffect } from 'react';
import { Notifications, Permissions } from 'expo';
import { Linking } from 'react-native';

/**
 * Constants
 */
const APP_ID = 'your-app-id';
const DEEPLINK_SCHEME = 'pointzeroonedigital://';

/**
 * Types
 */
type NotificationObject = {
  title: string;
  body: string;
  data?: any; // Temporary use of 'any' for data property, to be replaced with specific type later.
};

/**
 * Functions
 */
const registerForPushNotificationsAsync = async () => {
  const { status: existingStatus } = await Permissions.getAsync(Permissions.NOTIFICATIONS);
  let finalStatus = existingStatus;

  // Only ask if permissions have not already been granted
  if (existingStatus !== 'granted') {
    const { status } = await Permissions.askAsync(Permissions.NOTIFICATIONS, { resetOnRequest: true });
    finalStatus = status;
  }

  // Get the token that identifies this device
  let token;
  if (finalStatus === 'granted') {
    const tokenResult = await Notifications.getExpoPushTokenAsync();
    token = tokenResult.data;
  } else {
    console.log('Failed to get push token for push notification!');
  }

  // Save the token to your backend server
  // ...
};

const subscribeToPushNotificationsAsync = async () => {
  const { status: existingStatus } = await Permissions.getAsync(Permissions.NOTIFICATIONS);
  let finalStatus = existingStatus;

  // Only ask if permissions have not already been granted
  if (existingStatus !== 'granted') {
    const { status } = await Permissions.askAsync(Permissions.NOTIFICATIONS, { resetOnRequest: true });
    finalStatus = status;
  }

  // Subscribe to push notifications
  if (finalStatus === 'granted') {
    Notifications.subscribeToPushNotificationsAsync({ onNotification: handleNotification });
  }
};

const unsubscribeFromPushNotificationsAsync = async () => {
  await Notifications.unsubscribeToPushNotificationsAsync();
};

const handleNotification = (notification: NotificationObject) => {
  // Handle the incoming push notification
  Linking.openURL(DEEPLINK_SCHEME + notification.data?.screen || '');
};

/**
 * Lifecycle methods
 */
useEffect(() => {
  registerForPushNotificationsAsync();
  subscribeToPushNotificationsAsync();

  // Handle the app being opened from a push notification
  Notifications.addNotificationReceivedListener((notification) => {
    handleNotification(notification);
  });

  // Handle the app being opened from a background state
  Notifications.addNotificationResponseReceivedListener((response) => {
    handleNotification(response.notification);
  });

  // Handle the app being killed while in the background
  Notifications.addNotificationResponseOpenedListener((response) => {
    handleNotification(response.notification);
  });

  return () => {
    unsubscribeFromPushNotificationsAsync();
  };
}, []);

export { registerForPushNotificationsAsync, subscribeToPushNotificationsAsync, unsubscribeFromPushNotificationsAsync };
