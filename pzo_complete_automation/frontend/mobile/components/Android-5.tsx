import React from 'react';
import { View, Text } from 'react-native';
import { useCssInJs } from 'react-native-css-in-js';

const styles = useCssInJs`
View {
flex: 1;
justifyContent: center;
alignItems: center;
}

Text {
fontSize: 20;
fontWeight: 'bold';
}
`;

const Android5Component: React.FC = () => (
<View style={styles}>
<Text>Android-5</Text>
</View>
);

export default Android5Component;
