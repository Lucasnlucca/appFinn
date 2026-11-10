import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFinance } from '../context/FinanceContext';
import { NOTIFICATION_CATEGORIES } from '../services/notificationTemplates';
import { DEFAULT_NOTIFICATION_PREFERENCES } from '../services/notificationService';

const START_HOUR_OPTIONS = ['21:00', '22:00', '23:00'];
const END_HOUR_OPTIONS = ['07:00', '08:00', '09:00'];

const CATEGORY_ITEMS = [
  {
    key: NOTIFICATION_CATEGORIES.GASTOS,
    title: 'Gastos e Orçamento',
    description:
      'Gastos e receitas registradas, alertas de limite em 80% e 100% e despesas fora do padrão.',
    icon: 'trending-down-outline',
    color: '#B91C1C',
    bgColor: '#FEE2E2',
  },
  {
    key: NOTIFICATION_CATEGORIES.IA,
    title: 'Insights da FINN IA',
    description:
      'Resumo semanal, oportunidades de economia nos Cofrinhos, metas e leitura de comprovantes.',
    icon: 'sparkles-outline',
    color: '#5B21B6',
    bgColor: '#EDE9FE',
  },
  {
    key: NOTIFICATION_CATEGORIES.LEMBRETES,
    title: 'Lembretes e Vencimentos',
    description:
      'Lembrete diário de registro (quando não houver lançamentos no dia) e contas a vencer.',
    icon: 'notifications-outline',
    color: '#0369A1',
    bgColor: '#E0F2FE',
  },
  {
    key: NOTIFICATION_CATEGORIES.SISTEMA,
    title: 'Sistema e Compartilhadas',
    description:
      'Atualizações do aplicativo, novidades e convites ou atividades nas Finanças Compartilhadas.',
    icon: 'arrow-up-circle-outline',
    color: '#15803D',
    bgColor: '#DCFCE7',
  },
];

export default function NotificationPreferencesScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const {
    notificationPreferences = DEFAULT_NOTIFICATION_PREFERENCES,
    updateNotificationPreferences,
  } = useFinance();

  const prefs = {
    ...DEFAULT_NOTIFICATION_PREFERENCES,
    ...(notificationPreferences || {}),
    categories: {
      ...DEFAULT_NOTIFICATION_PREFERENCES.categories,
      ...(notificationPreferences?.categories || {}),
    },
  };

  const handleToggleCategory = (catKey) => {
    if (!updateNotificationPreferences) return;
    const current = prefs.categories[catKey] !== false;
    updateNotificationPreferences({
      ...prefs,
      categories: {
        ...prefs.categories,
        [catKey]: !current,
      },
    });
  };

  const handleToggleQuietHours = () => {
    if (!updateNotificationPreferences) return;
    updateNotificationPreferences({
      ...prefs,
      quietHoursEnabled: !prefs.quietHoursEnabled,
    });
  };

  const handleSelectQuietHours = (field, value) => {
    if (!updateNotificationPreferences) return;
    updateNotificationPreferences({
      ...prefs,
      [field]: value,
    });
  };

  const handleToggleHideAmounts = () => {
    if (!updateNotificationPreferences) return;
    updateNotificationPreferences({
      ...prefs,
      hideAmountsOnLockScreen: !prefs.hideAmountsOnLockScreen,
    });
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="dark-content" backgroundColor="#F4F1FB" />

      {/* CABEÇALHO */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backBtn}
          activeOpacity={0.75}
          accessibilityRole="button"
          accessibilityLabel="Voltar para a tela anterior"
        >
          <Ionicons name="arrow-back" size={22} color="#0F172A" />
        </TouchableOpacity>

        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Preferências de notificação</Text>
          <Text style={styles.headerSubtitle}>
            Controle categorias, horário de silêncio e privacidade
          </Text>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: Math.max(insets.bottom + 28, 36) },
        ]}
      >
        {/* SEÇÃO 1: CATEGORIAS */}
        <Text style={styles.sectionLabel}>CATEGORIAS DE ALERTA</Text>
        <View style={styles.cardGroup}>
          {CATEGORY_ITEMS.map((item, idx) => {
            const isEnabled = prefs.categories[item.key] !== false;
            return (
              <View
                key={item.key}
                style={[styles.prefRow, idx > 0 && styles.prefRowBorder]}
              >
                <View style={[styles.iconChip, { backgroundColor: item.bgColor }]}>
                  <Ionicons name={item.icon} size={20} color={item.color} />
                </View>

                <View style={styles.prefTextCol}>
                  <Text style={styles.prefTitle}>{item.title}</Text>
                  <Text style={styles.prefDesc}>{item.description}</Text>
                </View>

                <Switch
                  value={isEnabled}
                  onValueChange={() => handleToggleCategory(item.key)}
                  trackColor={{ false: '#CBD5E1', true: '#C4B5FD' }}
                  thumbColor={isEnabled ? '#5B21B6' : '#F8FAFC'}
                  accessibilityLabel={`Ativar ou desativar notificações de ${item.title}`}
                />
              </View>
            );
          })}
        </View>

        {/* SEÇÃO 2: HORÁRIO DE SILÊNCIO */}
        <Text style={styles.sectionLabel}>HORÁRIO DE SILÊNCIO</Text>
        <View style={styles.cardGroup}>
          <View style={styles.prefRow}>
            <View style={[styles.iconChip, { backgroundColor: '#EDE9FE' }]}>
              <Ionicons name="moon-outline" size={20} color="#5B21B6" />
            </View>

            <View style={styles.prefTextCol}>
              <Text style={styles.prefTitle}>Silenciar notificações à noite</Text>
              <Text style={styles.prefDesc}>
                Pausa envios entre {prefs.quietHoursStart} e {prefs.quietHoursEnd}, exceto alertas críticos (conta vencendo no dia ou saldo negativo).
              </Text>
            </View>

            <Switch
              value={Boolean(prefs.quietHoursEnabled)}
              onValueChange={handleToggleQuietHours}
              trackColor={{ false: '#CBD5E1', true: '#C4B5FD' }}
              thumbColor={prefs.quietHoursEnabled ? '#5B21B6' : '#F8FAFC'}
              accessibilityLabel="Ativar ou desativar horário de silêncio"
            />
          </View>

          {prefs.quietHoursEnabled && (
            <View style={styles.quietHoursScheduleBox}>
              <View style={styles.scheduleGroup}>
                <Text style={styles.scheduleLabel}>Início do silêncio</Text>
                <View style={styles.pillsRow}>
                  {START_HOUR_OPTIONS.map((hourStr) => {
                    const active = prefs.quietHoursStart === hourStr;
                    return (
                      <TouchableOpacity
                        key={hourStr}
                        style={[styles.timePill, active && styles.timePillActive]}
                        onPress={() => handleSelectQuietHours('quietHoursStart', hourStr)}
                        activeOpacity={0.8}
                        accessibilityRole="button"
                        accessibilityLabel={`Definir início do horário de silêncio para ${hourStr}`}
                      >
                        <Text
                          style={[
                            styles.timePillText,
                            active && styles.timePillTextActive,
                          ]}
                        >
                          {hourStr}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              <View style={[styles.scheduleGroup, { marginTop: 12 }]}>
                <Text style={styles.scheduleLabel}>Término (manhã)</Text>
                <View style={styles.pillsRow}>
                  {END_HOUR_OPTIONS.map((hourStr) => {
                    const active = prefs.quietHoursEnd === hourStr;
                    return (
                      <TouchableOpacity
                        key={hourStr}
                        style={[styles.timePill, active && styles.timePillActive]}
                        onPress={() => handleSelectQuietHours('quietHoursEnd', hourStr)}
                        activeOpacity={0.8}
                        accessibilityRole="button"
                        accessibilityLabel={`Definir fim do horário de silêncio para ${hourStr}`}
                      >
                        <Text
                          style={[
                            styles.timePillText,
                            active && styles.timePillTextActive,
                          ]}
                        >
                          {hourStr}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            </View>
          )}
        </View>

        {/* SEÇÃO 3: PRIVACIDADE */}
        <Text style={styles.sectionLabel}>PRIVACIDADE NA TELA BLOQUEADA</Text>
        <View style={styles.cardGroup}>
          <View style={styles.prefRow}>
            <View style={[styles.iconChip, { backgroundColor: '#E0F2FE' }]}>
              <Ionicons name="lock-closed-outline" size={20} color="#0369A1" />
            </View>

            <View style={styles.prefTextCol}>
              <Text style={styles.prefTitle}>Ocultar valores na tela bloqueada</Text>
              <Text style={styles.prefDesc}>
                Substitui valores em R$ por mensagens discretas nos alertas da barra do celular.
              </Text>
            </View>

            <Switch
              value={Boolean(prefs.hideAmountsOnLockScreen)}
              onValueChange={handleToggleHideAmounts}
              trackColor={{ false: '#CBD5E1', true: '#C4B5FD' }}
              thumbColor={prefs.hideAmountsOnLockScreen ? '#5B21B6' : '#F8FAFC'}
              accessibilityLabel="Ocultar valores monetários na tela bloqueada"
            />
          </View>

          <View style={styles.previewBox}>
            <Text style={styles.previewLabel}>PRÉVIA DO ALERTA NO CELULAR</Text>
            <Text style={styles.previewTitle}>
              {prefs.hideAmountsOnLockScreen
                ? 'Novo gasto registrado'
                : 'Gasto de R$ 20,00'}
            </Text>
            <Text style={styles.previewBody}>
              {prefs.hideAmountsOnLockScreen
                ? 'Um novo gasto em Alimentação foi registrado na sua conta.'
                : 'Gasto de R$ 20,00 em Alimentação registrado. Fique de olho no limite mensal.'}
            </Text>
          </View>
        </View>

        {/* INFORMAÇÃO DE FREQUÊNCIA */}
        <View style={styles.infoFooterCard}>
          <Ionicons name="shield-checkmark-outline" size={18} color="#5B21B6" />
          <Text style={styles.infoFooterText}>
            O FINN respeita o limite máximo de 3 notificações push por dia e agrupa insights automaticamente para não interromper sua rotina.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F4F1FB',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.3,
  },
  headerSubtitle: {
    fontSize: 12.5,
    color: '#475569',
    fontWeight: '500',
    marginTop: 2,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 6,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
    letterSpacing: 0.8,
    marginTop: 14,
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  cardGroup: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 6,
  },
  prefRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    gap: 12,
    minHeight: 68,
  },
  prefRowBorder: {
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  iconChip: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  prefTextCol: {
    flex: 1,
    paddingRight: 4,
  },
  prefTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
  },
  prefDesc: {
    fontSize: 12.5,
    color: '#475569',
    lineHeight: 18,
    marginTop: 3,
  },
  quietHoursScheduleBox: {
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingVertical: 14,
  },
  scheduleGroup: {
    gap: 8,
  },
  scheduleLabel: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#334155',
  },
  pillsRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  timePill: {
    minHeight: 44,
    minWidth: 76,
    paddingHorizontal: 16,
    borderRadius: 999,
    backgroundColor: '#F4F1FB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  timePillActive: {
    backgroundColor: '#5B21B6',
  },
  timePillText: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#334155',
  },
  timePillTextActive: {
    color: '#FFFFFF',
  },
  previewBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  previewLabel: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#5B21B6',
    letterSpacing: 0.6,
    marginBottom: 4,
  },
  previewTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
  },
  previewBody: {
    fontSize: 12.5,
    color: '#475569',
    marginTop: 2,
    lineHeight: 18,
  },
  infoFooterCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#EDE9FE',
    borderRadius: 16,
    padding: 14,
    marginTop: 18,
  },
  infoFooterText: {
    flex: 1,
    fontSize: 12,
    color: '#4C1D95',
    lineHeight: 17,
    fontWeight: '600',
  },
});

