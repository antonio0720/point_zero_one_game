import React from 'react';
import { View, Text } from 'react-native';
import { useNavigation } from '@react-navigation/native';

const Android6 = () => {
const navigation = useNavigation();

const handlePress = () => {
// Perform some action when the button is pressed.
};

return (
<View>
<Text>Welcome to Android-6</Text>
<Button title="Go Back" onPress={() => navigation.goBack()} />
<Button title="Go Home" onPress={() => navigation.navigate('Home')} />
{/* Add other components or functionality as needed */}
</View>
);
};

const Button = ({ title, onPress }) => (
<TouchableOpacity onPress={onPress}>
<Text style={{ padding: 10 }}>{title}</Text>
</TouchableOpacity>
);

export default Android6;
