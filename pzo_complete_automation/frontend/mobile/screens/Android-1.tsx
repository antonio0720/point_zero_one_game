import React from 'react';
import { View, Text } from 'react-native';
import { useNavigation } from '@react-navigation/native';

const Android1 = () => {
const navigation = useNavigation();

return (
<View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
<Text>Welcome to Android-1 Screen</Text>
<View style={{ marginTop: 20 }}>
<TouchableOpacity onPress={() => navigation.navigate('Home')}>
<Text>Go to Home Screen</Text>
</TouchableOpacity>
</View>
</View>
);
};

export default Android1;
