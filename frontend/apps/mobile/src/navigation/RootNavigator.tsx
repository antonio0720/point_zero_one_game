/**
 * RootNavigator.tsx
 * Unauthenticated stack (Welcome, Login, Register), authenticated tabs (Play, Leaderboards, Profile, Creator), modal stack (ProofExplorer, CardScan, ShareSheet); deep link handling for run proof links.
 */

import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useAuth } from '../contexts/AuthContext';
import Welcome from '../screens/Welcome';
import Login from '../screens/Login';
import Register from '../screens/Register';
import Play from '../screens/Play';
import Leaderboards from '../screens/Leaderboards';
import Profile from '../screens/Profile';
import Creator from '../screens/Creator';
import ProofExplorer from '../screens/ProofExplorer';
import CardScan from '../screens/CardScan';
import ShareSheet from '../screens/ShareSheet';
import Linking, { LinkingOptions } from 'react-native';

const Stack = createStackNavigator<any>();
const Tab = createBottomTabNavigator<any>();

const UnauthenticatedStack = () => (
  <Stack.Navigator initialRouteName="Welcome">
    <Stack.Screen name="Welcome" component={Welcome} />
    <Stack.Screen name="Login" component={Login} />
    <Stack.Screen name="Register" component={Register} />
  </Stack.Navigator>
);

const AuthenticatedTabs = () => (
  <Tab.Navigator>
    <Tab.Screen name="Play" component={Play} />
    <Tab.Screen name="Leaderboards" component={Leaderboards} />
    <Tab.Screen name="Profile" component={Profile} />
    <Tab.Screen name="Creator" component={Creator} />
  </Tab.Navigator>
);

const ModalStack = () => (
  <Stack.Navigator screenOptions={{ presentation: 'modal' }}>
    <Stack.Screen name="ProofExplorer" component={ProofExplorer} />
    <Stack.Screen name="CardScan" component={CardScan} />
    <Stack.Screen name="ShareSheet" component={ShareSheet} />
  </Stack.Navigator>
);

const RootNavigator = () => {
  const { isAuthenticated } = useAuth();

  const linking = {
    prefixes: ['pointzeroonedigital://'],
    config: {
      Screens: {
        ProofExplorer: 'proof-explorer/:id',
      },
    },
  };

  return (
    <NavigationContainer linking={linking} fallback={<></>}>
      {isAuthenticated ? (
        <Tab.Navigator>
          <Tab.Screen name="Tabs" children={() => (
            <>
              {UnauthenticatedStack()}
              {AuthenticatedTabs()}
              {ModalStack()}
            </>
          )} />
        </Tab.Navigator>
      ) : (
        UnauthenticatedStack()
      )}
    </NavigationContainer>
  );
};

export default RootNavigator;
