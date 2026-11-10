import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Platform, ActivityIndicator, Text, TouchableOpacity } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import { Asset } from 'expo-asset';

import { COLORS } from './src/theme/colors';
import { FinanceProvider, useFinance } from './src/context/FinanceContext';
import { CustomAlertProvider } from './src/context/CustomAlertContext';

import HomeScreen from './src/screens/HomeScreen';
import TransactionsScreen from './src/screens/TransactionsScreen';
import PlanningScreen from './src/screens/PlanningScreen';
import FinnAIScreen from './src/screens/FinnAIScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import CardsAccountsScreen from './src/screens/CardsAccountsScreen';
import CardInvoicesScreen from './src/screens/CardInvoicesScreen';
import MonthlyAgendaScreen from './src/screens/MonthlyAgendaScreen';
import SharedFinancesScreen from './src/screens/SharedFinancesScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import LoginScreen from './src/screens/LoginScreen';
import NotificationPreferencesScreen from './src/screens/NotificationPreferencesScreen';
import AddTransactionModal from './src/components/AddTransactionModal';
import FloatingAiButton from './src/components/FloatingAiButton';
import LiquidTabBar from './src/components/LiquidTabBar';
import AppIntroSplash from './src/components/AppIntroSplash';

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
          options={{ tabBarLabel: 'Transações' }}
        />

        {/* 3. Botão Central (+) */}
        <Tab.Screen
          name="AddAction"
          component={EmptyAddScreen}
          options={{ tabBarLabel: '' }}
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
  const { loggedInUser } = useFinance();

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
        <Stack.Screen name="CardInvoices" component={CardInvoicesScreen} />
        <Stack.Screen name="MonthlyAgenda" component={MonthlyAgendaScreen} />
        <Stack.Screen name="SharedFinances" component={SharedFinancesScreen} />
        <Stack.Screen name="Profile" component={ProfileScreen} />
        <Stack.Screen
          name="NotificationPreferences"
          component={NotificationPreferencesScreen}
        />
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

function AppBody({ assetsLoaded, isFontsReady }) {
  const { loaded } = useFinance();
  const [splashDismissed, setSplashDismissed] = useState(false);

  const isAppReady = Boolean(loaded && assetsLoaded && isFontsReady);

  return (
    <>
      <StatusBar
        style={splashDismissed ? "dark" : "light"}
        backgroundColor={splashDismissed ? COLORS.bg : "#000000"}
      />
      <View style={{ flex: 1, backgroundColor: '#000000' }}>
        {splashDismissed ? (
          <MainAppContent />
        ) : (
          <AppIntroSplash
            isAppReady={isAppReady}
            onFinish={() => setSplashDismissed(true)}
          />
        )}
      </View>
    </>
  );
}

export default function App() {
  const [fontsLoaded, fontError] = useFonts({
    Audiowide: require('./assets/fonts/Audiowide-Regular.ttf'),
  });
  const [assetsLoaded, setAssetsLoaded] = useState(false);

  useEffect(() => {
    async function preloadAssets() {
      try {
        await Asset.loadAsync([
          require('./assets/finn-hero-poster.jpg'),
          require('./assets/hero-robot-bg.jpg'),
          require('./assets/finn-logo.png'),
          require('./assets/finn-login-robot.png'),
          require('./assets/agenda-robot-happy.png'),
          require('./assets/agenda-robot-sad.png'),
          require('./assets/card-invoices-waves.png'),
          require('./assets/finn-ai-avatar.png'),
          require('./assets/finn-chat-hero.png'),
        ]);
      } catch (e) {
        console.warn('Aviso no pré-carregamento de assets locais:', e);
      } finally {
        setAssetsLoaded(true);
      }
    }
    preloadAssets();
  }, []);

  const isFontsReady = Boolean(fontsLoaded || fontError);

  return (
    <SafeAreaProvider>
      <FinanceProvider>
        <CustomAlertProvider>
          <AppBody
            assetsLoaded={assetsLoaded}
            isFontsReady={isFontsReady}
          />
        </CustomAlertProvider>
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
    fontFamily: 'Audiowide',
    color: COLORS.navy,
    fontSize: 24,
    marginTop: 14,
    letterSpacing: 1.5,
  },
});
