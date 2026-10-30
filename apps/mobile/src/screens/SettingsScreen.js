import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../theme/colors';
import { useFinance } from '../context/FinanceContext';

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const { members, updateMembersNames, clearAllData, allTransactions } = useFinance();
  const [user1, setUser1] = useState(members.user1);
  const [user2, setUser2] = useState(members.user2);
  const [savedNotice, setSavedNotice] = useState(false);

  const handleSaveNames = () => {
    updateMembersNames({ user1: user1.trim() || 'Henrique', user2: user2.trim() || 'Esposa' });
    setSavedNotice(true);
    setTimeout(() => setSavedNotice(false), 2500);
  };

  const handleReset = () => {
    Alert.alert(
      'Zerar Dados do Aplicativo',
      'Tem certeza que deseja apagar todas as despesas e saldos para começar do zero?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Sim, Apagar Tudo',
          style: 'destructive',
          onPress: async () => {
            await clearAllData();
            Alert.alert('Pronto', 'Todos os dados foram resetados com sucesso!');
          },
        },
      ]
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.bg} />

      <View style={styles.header}>
        <Text style={styles.headerTitle}>Configurações do Casal</Text>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 90 }]}
      >
        {/* CARD PERFIL DO CASAL */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={styles.iconCircle}>
              <Ionicons name="people" size={20} color={COLORS.primary} />
            </View>
            <View>
              <Text style={styles.cardTitle}>Nomes do Casal</Text>
              <Text style={styles.cardSubtitle}>Identificação nas despesas e no FINN AI</Text>
            </View>
          </View>

          <Text style={styles.label}>Você</Text>
          <TextInput
            style={styles.input}
            value={user1}
            onChangeText={setUser1}
            placeholder="Nome (Ex: Henrique)"
            placeholderTextColor={COLORS.textMuted}
          />

          <Text style={styles.label}>Sua Esposa</Text>
          <TextInput
            style={styles.input}
            value={user2}
            onChangeText={setUser2}
            placeholder="Nome (Ex: Esposa)"
            placeholderTextColor={COLORS.textMuted}
          />

          <TouchableOpacity style={styles.saveBtn} onPress={handleSaveNames}>
            <Text style={styles.saveBtnText}>
              {savedNotice ? '✓ Salvo com sucesso!' : 'Atualizar Nomes'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* ESTATÍSTICAS DO BANCO LOCAL */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={[styles.iconCircle, { backgroundColor: 'rgba(59, 130, 246, 0.15)' }]}>
              <Ionicons name="server-outline" size={20} color={COLORS.info} />
            </View>
            <View>
              <Text style={styles.cardTitle}>Armazenamento Local</Text>
              <Text style={styles.cardSubtitle}>Seus dados salvos diretamente no seu aparelho</Text>
            </View>
          </View>

          <View style={styles.storageRow}>
            <Text style={styles.storageLabel}>Lançamentos salvos:</Text>
            <Text style={styles.storageVal}>{allTransactions.length} registros</Text>
          </View>
          <View style={styles.storageRow}>
            <Text style={styles.storageLabel}>Privacidade:</Text>
            <Text style={[styles.storageVal, { color: COLORS.primary }]}>Exclusivo de vocês</Text>
          </View>
        </View>

        {/* ZONA DE PERIGO / RESET TOTAL */}
        <View style={[styles.card, { borderColor: 'rgba(244, 63, 94, 0.3)' }]}>
          <View style={styles.cardHeader}>
            <View style={[styles.iconCircle, { backgroundColor: 'rgba(244, 63, 94, 0.15)' }]}>
              <Ionicons name="trash-bin-outline" size={20} color={COLORS.expense} />
            </View>
            <View>
              <Text style={[styles.cardTitle, { color: COLORS.expense }]}>Zerar Tudo e Começar Limpo</Text>
              <Text style={styles.cardSubtitle}>Apaga todos os dados e zera o saldo</Text>
            </View>
          </View>

          <TouchableOpacity style={styles.dangerBtn} onPress={handleReset}>
            <Ionicons name="trash-outline" size={18} color={COLORS.expense} />
            <Text style={styles.dangerBtnText}>Zerar Todos os Dados</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.versionText}>FINN AI Mobile • Versão 2.0 Nativa Expo</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.surfaceBorder,
    backgroundColor: COLORS.surface,
  },
  headerTitle: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: '800',
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 16,
    gap: 16,
  },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: COLORS.surfaceBorder,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: COLORS.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: '700',
  },
  cardSubtitle: {
    color: COLORS.textMuted,
    fontSize: 12,
    marginTop: 2,
  },
  label: {
    color: COLORS.textSecondary,
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 6,
  },
  input: {
    backgroundColor: COLORS.surfaceLight,
    borderWidth: 1,
    borderColor: COLORS.surfaceBorder,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
    color: COLORS.text,
    fontSize: 15,
    marginBottom: 14,
  },
  saveBtn: {
    backgroundColor: COLORS.primary,
    paddingVertical: 13,
    borderRadius: 14,
    alignItems: 'center',
    marginTop: 4,
  },
  saveBtnText: {
    color: COLORS.white,
    fontWeight: '700',
    fontSize: 14,
  },
  storageRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.surfaceBorder,
  },
  storageLabel: {
    color: COLORS.textSecondary,
    fontSize: 14,
  },
  storageVal: {
    color: COLORS.text,
    fontWeight: '600',
    fontSize: 14,
  },
  dangerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: 'rgba(244, 63, 94, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(244, 63, 94, 0.3)',
    paddingVertical: 13,
    borderRadius: 14,
    marginTop: 6,
  },
  dangerBtnText: {
    color: COLORS.expense,
    fontWeight: '700',
    fontSize: 14,
  },
  versionText: {
    color: COLORS.textMuted,
    fontSize: 12,
    textAlign: 'center',
    marginTop: 10,
  },
});
