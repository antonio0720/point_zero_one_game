import React from 'react';
import { View, Text } from 'react-native';
import { useIsFocused } from '@react-navigation/native';

const Android12 = () => {
const isFocused = useIsFocused();

return (
<View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
{isFocused && <Text>Welcome to the Android-12 app!</Text>}
</View>
);
};

export default Android12;
