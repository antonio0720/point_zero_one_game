import React from 'react';
import { View, Text } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';

const iOS15Screen = () => {
useFocusEffect(
React.useCallback(() => {
// Perform any setup that should happen when the screen is focused
// For example, fetching data or setting up notifications.
}, [])
);

return (
<View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
<Text>Welcome to iOS 15!</Text>
</View>
);
};

export default iOS15Screen;
