import { StatusBar } from 'expo-status-bar';
import { StyleSheet, View, ActivityIndicator } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import "./global.css"
import Toast from 'react-native-toast-message'

import { AuthProvider, AuthContext } from './src/context/AuthContext';
import { LanguageProvider } from './src/context/LanguageContext';
import { registerPWA } from './src/registerPWA';
import React, { useContext, useEffect } from 'react';

import Login from './screens/Auth/Login';
import Signup from './screens/Auth/Signup';
import AppDrawer from './src/navigation/AppDrawer';
import TenantRegister from './screens/Auth/TenantRegister';

const Stack = createNativeStackNavigator();

function AppNavigation() {
  const { user, isLoading } = useContext(AuthContext);

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#4f46e5" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {user ? (
          <Stack.Screen name="AppDrawer" component={AppDrawer} />
        ) : (
          <>
            <Stack.Screen name="TenantRegister" component={TenantRegister} />
            <Stack.Screen name="Login" component={Login} />
            <Stack.Screen name="Signup" component={Signup} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

export default function App() {
  useEffect(() => {
    registerPWA();
  }, []);

  return (
    <SafeAreaProvider>
      <LanguageProvider>
        <AuthProvider>
          <AppNavigation />
          <Toast />
          <StatusBar style="auto" />
        </AuthProvider>
      </LanguageProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
});