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

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

// Botão central elevado azul marinho com '+'
function CustomAddTabButton({ onPress }) {
  return (
    <View style={styles.addTabBtnContainer} pointerEvents="box-none">
      <TouchableOpacity
        style={styles.addTabBtn}
        onPress={onPress}
        activeOpacity={0.85}
      >
        <Ionicons name="add" size={28} color={COLORS.white} />
      </TouchableOpacity>
    </View>
  );
}

// Dummy screen para a tab central
function EmptyAddScreen() {
  return null;
}

function MainTabs({ navigation }) {
  const [modalVisible, setModalVisible] = useState(false);

  return (
    <View style={{ flex: 1 }}>
      <Tab.Navigator
        screenOptions={({ route }) => ({
          headerShown: false,
          tabBarShowLabel: true,
          tabBarActiveTintColor: COLORS.navy,
          tabBarInactiveTintColor: COLORS.textMuted,
          tabBarStyle: {
            backgroundColor: COLORS.white,
            borderTopColor: COLORS.surfaceBorder,
            borderTopWidth: 1,
            height: Platform.OS === 'ios' ? 86 : 66,
            paddingBottom: Platform.OS === 'ios' ? 26 : 10,
            paddingTop: 8,
            elevation: 8,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: -2 },
            shadowOpacity: 0.05,
            shadowRadius: 6,
          },
          tabBarLabelStyle: {
            fontSize: 11,
            fontWeight: '600',
          },
          tabBarIcon: ({ focused, color, size }) => {
            if (route.name === 'AddAction') {
              return null;
            }

            let iconName = 'ellipse-outline';
            if (route.name === 'Home') {
              iconName = focused ? 'home' : 'home-outline';
            } else if (route.name === 'Transactions') {
              iconName = focused ? 'receipt' : 'receipt-outline';
            } else if (route.name === 'Planning') {
              iconName = focused ? 'grid' : 'grid-outline';
            } else if (route.name === 'Mais' || route.name === 'Settings') {
              iconName = focused ? 'menu' : 'menu-outline';
            }

            return <Ionicons name={iconName} size={22} color={color} />;
          },
        })}
      >
        {/* 1. Início */}
        <Tab.Screen
          name="Home"
          component={HomeScreen}
          options={{ tabBarLabel: 'Início' }}
        />

        {/* 2. Transações */}
        <Tab.Screen
          name="Transactions"
          component={TransactionsScreen}
          options={{ tabBarLabel: 'Transações' }}
        />

        {/* 3. Botão Central (+) */}
        <Tab.Screen
          name="AddAction"
          component={EmptyAddScreen}
          options={{
            tabBarLabel: '',
            tabBarButton: () => (
              <CustomAddTabButton onPress={() => setModalVisible(true)} />
            ),
          }}
        />

        {/* 4. Planejamento */}
        <Tab.Screen
          name="Planning"
          component={PlanningScreen}
          options={{ tabBarLabel: 'Planejamento' }}
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
  addTabBtnContainer: {
    top: -16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addTabBtn: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: COLORS.navy,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: COLORS.navy,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 8,
    borderWidth: 3,
    borderColor: COLORS.white,
  },
});
