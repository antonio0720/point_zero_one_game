import React from 'react';
import { View, Text } from 'react-native';
import { useColorScheme } from 'react-native';

const iOS16Screen = () => {
const isDarkMode = useColorScheme() === 'dark';

const style = StyleSheet.create({
container: {
flex: 1,
backgroundColor: isDarkMode ? '#000' : '#fff',
alignItems: 'center',
justifyContent: 'center',
},
title: {
fontSize: 20,
fontWeight: 'bold',
},
});

return (
<View style={style.container}>
<Text style={[style.title, { color: isDarkMode ? '#fff' : '#000' }]}>Welcome to iOS-16!</Text>
</View>
);
};

export default iOS16Screen;
