import React from 'react';
import { View, Text } from 'react-native';
import { useNavigation } from '@react-navigation/native';

const iOS3Screen = () => {
const navigation = useNavigation();

return (
<View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
<Text>Welcome to iOS-3 Screen!</Text>
{/* Add your components or buttons here */}
</View>
);
};

export default iOS3Screen;
