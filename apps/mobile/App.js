import React, { useState } from 'react';
import { View, StyleSheet, Platform, ActivityIndicator, Text, TouchableOpacity } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';

import { COLORS } from './src/theme/colors';
import { FinanceProvider, useFinance } from './src/context/FinanceContext';

import HomeScreen from './src/screens/HomeScreen';
import TransactionsScreen from './src/screens/TransactionsScreen';
import PlanningScreen from './src/screens/PlanningScreen';
import FinnAIScreen from './src/screens/FinnAIScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import CardsAccountsScreen from './src/screens/CardsAccountsScreen';
import LoginScreen from './src/screens/LoginScreen';
import AddTransactionModal from './src/components/AddTransactionModal';
import FloatingAiButton from './src/components/FloatingAiButton';
import LiquidTabBar from './src/components/LiquidTabBar';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

// Dummy screen para a tab central (+) tratada pelo LiquidTabBar
function EmptyAddScreen() {
  return null;
}

function MainTabs({ navigation }) {
  const [modalVisible, setModalVisible] = useState(false);

  return (
    <View style={{ flex: 1 }}>
      <Tab.Navigator
        tabBar={(props) => (
          <LiquidTabBar {...props} onAddPress={() => setModalVisible(true)} />
        )}
        screenOptions={{
          headerShown: false,
        }}
      >
        {/* 1. Início */}
        <Tab.Screen
          name="Home"
          component={HomeScreen}
          options={{ tabBarLabel: 'Início' }}
        />

        {/* 2. Extrato & Transações */}
        <Tab.Screen
          name="Transactions"
          component={TransactionsScreen}
          options={{ tabBarLabel: 'Extrato' }}
        />

        {/* 3. Botão Central (+) */}
        <Tab.Screen
          name="AddAction"
          component={EmptyAddScreen}
          options={{ tabBarLabel: '' }}
        />

        {/* 4. Planejamento / Metas */}
        <Tab.Screen
          name="Planning"
          component={PlanningScreen}
          options={{ tabBarLabel: 'Metas' }}
        />

        {/* 5. Mais */}
        <Tab.Screen
          name="Mais"
          component={SettingsScreen}
          options={{ tabBarLabel: 'Mais' }}
        />
      </Tab.Navigator>

      {/* Botão flutuante global da IA (arrastável livremente sobre todas as abas) */}
      <FloatingAiButton onPress={() => navigation.navigate('FinnAI')} />

      {/* Modal acionado pelo botão central (+) */}
      <AddTransactionModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
      />
    </View>
  );
}

function MainAppContent() {
  const { loggedInUser, loaded } = useFinance();

  if (!loaded) {
    return (
      <View style={styles.splashContainer}>
        <View style={styles.splashBadge}>
          <Ionicons name="sparkles" size={36} color={COLORS.navy} />
        </View>
        <Text style={styles.splashTitle}>FINN</Text>
        <ActivityIndicator size="small" color={COLORS.navy} style={{ marginTop: 16 }} />
      </View>
    );
  }

  if (!loggedInUser) {
    return <LoginScreen />;
  }

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="MainTabs" component={MainTabs} />
        <Stack.Screen name="Mais" component={SettingsScreen} />
        <Stack.Screen name="Settings" component={SettingsScreen} />
        <Stack.Screen name="CardsAccounts" component={CardsAccountsScreen} />
        <Stack.Screen
          name="FinnAI"
          component={FinnAIScreen}
          options={{
            presentation: 'modal',
            animation: 'slide_from_bottom',
          }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <FinanceProvider>
        <StatusBar style="dark" backgroundColor={COLORS.bg} />
        <MainAppContent />
      </FinanceProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  splashContainer: {
    flex: 1,
    backgroundColor: COLORS.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  splashBadge: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: COLORS.white,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: COLORS.surfaceBorder,
  },
  splashTitle: {
    color: COLORS.navy,
    fontSize: 24,
    fontWeight: '900',
    marginTop: 14,
    letterSpacing: 1,
  },
});
