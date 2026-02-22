import React from 'react';
import { View, Text, Button } from 'react-native';

const iOS6Screen = () => {
return (
<View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
<Text>Welcome to iOS 6!</Text>
<Button title="Go Back" onPress={() => alert('Going back...')} />
</View>
);
};

export default iOS6Screen;
