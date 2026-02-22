import React from 'react';
import { View, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const iOS13Component = () => {
const insets = useSafeAreaInsets();

return (
<View style={{
flex: 1,
paddingTop: insets.top,
}}>
<Text>iOS-13 compatible component</Text>
</View>
);
};

export default iOS13Component;
