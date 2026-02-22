import * as React from 'react';
import { View, Text, StyleSheet } from 'react-native';

type Props = {
// Add your prop types here
};

const Android8: React.FC<Props> = ({ /* your props */ }) => {
return (
<View style={styles.container}>
<Text style={styles.text}>Android-8</Text>
</View>
);
};

const styles = StyleSheet.create({
container: {
flex: 1,
justifyContent: 'center',
alignItems: 'center',
},
text: {
fontSize: 20,
},
});

export default Android8;
