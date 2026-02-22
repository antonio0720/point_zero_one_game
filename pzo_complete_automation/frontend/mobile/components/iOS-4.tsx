import React from 'react';
import { View, Text } from 'react-native';
import { useColorScheme } from 'react-native';

const iOS4 = () => {
const isDarkMode = useColorScheme() === 'dark';

const backgroundStyle = {
flex: 1,
justifyContent: 'center',
alignItems: 'center',
backgroundColor: isDarkMode ? Colors.darker : Colors.lighter,
};

return (
<View style={backgroundStyle}>
<Text>Mobile client complete - iOS-4</Text>
</View>
);
};

export default iOS4;
