import * as React from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface Props {
title?: string;
}

const Android14 = (props: Props) => {
const { title } = props;

return (
<View style={styles.container}>
<View style={styles.titleContainer}>
{title && <Text style={styles.title}>{title}</Text>}
</View>
{/* Add your component's content here */}
</View>
);
};

const styles = StyleSheet.create({
container: {
flex: 1,
backgroundColor: '#fff',
alignItems: 'center',
justifyContent: 'center',
width: 375, // Android device screen width (assuming 14 is a dimension)
height: 667, // Android device screen height (assuming 14 is a dimension)
},
titleContainer: {
marginBottom: 20,
},
title: {
fontSize: 20,
fontWeight: 'bold',
},
});

export default Android14;
