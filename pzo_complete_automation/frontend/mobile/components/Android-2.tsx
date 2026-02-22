import React from 'react';
import { View, Text } from 'react-native';
import { useTheme } from '@react-navigation/native';

const Android2 = () => {
const { colors } = useTheme();

return (
<View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
<Text style={{ color: colors.text }}>Android-2</Text>
</View>
);
};

export default Android2;
