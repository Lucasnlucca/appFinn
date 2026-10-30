import React from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';

import { COLORS } from './src/theme/colors';
import { FinanceProvider } from './src/context/FinanceContext';

import HomeScreen from './src/screens/HomeScreen';
import TransactionsScreen from './src/screens/TransactionsScreen';
import FinnAIScreen from './src/screens/FinnAIScreen';
import CardsAccountsScreen from './src/screens/CardsAccountsScreen';
import SettingsScreen from './src/screens/SettingsScreen';

const Tab = createBottomTabNavigator();

export default function App() {
  return (
    <SafeAreaProvider>
      <FinanceProvider>
        <StatusBar style="light" backgroundColor={COLORS.bg} />
        <NavigationContainer>
          <Tab.Navigator
            screenOptions={({ route }) => ({
              headerShown: false,
              tabBarShowLabel: true,
              tabBarActiveTintColor: COLORS.primary,
              tabBarInactiveTintColor: COLORS.textMuted,
              tabBarStyle: {
                backgroundColor: COLORS.surface,
                borderTopColor: COLORS.surfaceBorder,
                borderTopWidth: 1,
                height: Platform.OS === 'ios' ? 88 : 68,
                paddingBottom: Platform.OS === 'ios' ? 28 : 10,
                paddingTop: 8,
              },
              tabBarLabelStyle: {
                fontSize: 11,
                fontWeight: '600',
              },
              tabBarIcon: ({ focused, color, size }) => {
                let iconName;

                if (route.name === 'Home') {
                  iconName = focused ? 'home' : 'home-outline';
                } else if (route.name === 'Transactions') {
                  iconName = focused ? 'receipt' : 'receipt-outline';
                } else if (route.name === 'FinnAI') {
                  return (
                    <View style={styles.aiTabBtn}>
                      <Ionicons name="sparkles" size={20} color={COLORS.white} />
                    </View>
                  );
                } else if (route.name === 'CardsAccounts') {
                  iconName = focused ? 'wallet' : 'wallet-outline';
                } else if (route.name === 'Settings') {
                  iconName = focused ? 'settings' : 'settings-outline';
                }

                return <Ionicons name={iconName} size={22} color={color} />;
              },
            })}
          >
            <Tab.Screen
              name="Home"
              component={HomeScreen}
              options={{ tabBarLabel: 'Início' }}
            />
            <Tab.Screen
              name="Transactions"
              component={TransactionsScreen}
              options={{ tabBarLabel: 'Extrato' }}
            />
            <Tab.Screen
              name="FinnAI"
              component={FinnAIScreen}
              options={{
                tabBarLabel: 'FINN IA',
                tabBarLabelStyle: {
                  fontSize: 11,
                  fontWeight: '700',
                  color: COLORS.primary,
                },
              }}
            />
            <Tab.Screen
              name="CardsAccounts"
              component={CardsAccountsScreen}
              options={{ tabBarLabel: 'Contas' }}
            />
            <Tab.Screen
              name="Settings"
              component={SettingsScreen}
              options={{ tabBarLabel: 'Config' }}
            />
          </Tab.Navigator>
        </NavigationContainer>
      </FinanceProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  aiTabBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Platform.OS === 'ios' ? 14 : 12,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 6,
  },
});
