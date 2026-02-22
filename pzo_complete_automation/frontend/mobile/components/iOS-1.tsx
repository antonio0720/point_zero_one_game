import * as React from 'react';
import { View, Text } from 'react-native';

const iOS1 = (props) => {
return (
<View style={{flex: 1, justifyContent: 'center', alignItems: 'center'}}>
<Text>{props.title}</Text>
</View>
);
};

export default iOS1;
