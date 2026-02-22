import React from 'react';
import { View, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const Android11Screen = () => {
const insets = useSafeAreaInsets();

return (
<View style={{ flex: 1, paddingTop: insets.top }}>
<Text>Android 11 Compatible Screen</Text>
</View>
);
};

export default Android11Screen;
