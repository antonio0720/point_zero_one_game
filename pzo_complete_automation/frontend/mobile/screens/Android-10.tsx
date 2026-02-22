import React from 'react';
import { View, Text } from 'react-native';
import { useIsFocused } from '@react-navigation/native';

const Android10Screen = () => {
const isFocused = useIsFocused();

return (
<View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
{isFocused && <Text>Welcome to the Android-10 screen!</Text>}
</View>
);
};

export default Android10Screen;
