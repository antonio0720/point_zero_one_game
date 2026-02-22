// Import required libraries
import React from 'react';
import { View, Text } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';

// Custom components and styles (replace with your own imports)
// ...

const Stack = createStackNavigator();

const MainScreen = () => {
return (
<View style={styles.container}>
<Text style={styles.title}>iOS-14 App</Text>
{/* Your screen content */}
</View>
);
};

const Navigation = () => {
return (
<NavigationContainer>
<Stack.Navigator initialRouteName="Main">
<Stack.Screen name="Main" component={MainScreen} />
{/* Add more screens if necessary */}
</Stack.Navigator>
</NavigationContainer>
);
};

const App = () => {
return (
<View style={styles.appContainer}>
<Navigation />
</View>
);
};

// Add your styles here
const styles = StyleSheet.create({
container: {
flex: 1,
alignItems: 'center',
justifyContent: 'center',
},
title: {
fontSize: 20,
fontWeight: 'bold',
},
appContainer: {
// Add your styles here
},
});

export default App;
