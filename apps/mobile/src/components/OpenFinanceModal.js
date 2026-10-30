import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../theme/colors';
import { SUPPORTED_BANKS, connectBank, syncOpenFinanceTransactions } from '../services/openFinanceService';
import { useFinance } from '../context/FinanceContext';

export default function OpenFinanceModal({ visible, onClose, onBankConnected }) {
  const { addTransaction, updateAccountBalance, accounts } = useFinance();
  const [connectingBankId, setConnectingBankId] = useState(null);
  const [syncStep, setSyncStep] = useState(null); // 'CONSENT' | 'CONNECTING' | 'SUCCESS'
  const [selectedBank, setSelectedBank] = useState(null);

  const handleSelectBank = (bank) => {
    setSelectedBank(bank);
    setSyncStep('CONSENT');
  };

  const handleConfirmConsent = async () => {
    if (!selectedBank) return;
    setConnectingBankId(selectedBank.id);
    setSyncStep('CONNECTING');

    try {
      // 1. Cria o registro de consentimento criptografado Bacen
      await connectBank(selectedBank.id);

      // 2. Busca movimentações bancárias recentes via Open Finance
      const importedTx = await syncOpenFinanceTransactions(selectedBank.id);

      // 3. Atualiza saldo da conta correspondente se houver
      const targetAcc = accounts.find((a) =>
        a.name.toLowerCase().includes(selectedBank.name.toLowerCase()) ||
        a.bank.toLowerCase().includes(selectedBank.name.toLowerCase())
      );

      if (targetAcc) {
        await updateAccountBalance(targetAcc.id, selectedBank.defaultBalance);
      }

      // 4. Lança as transações automáticas de leitura
      for (const tx of importedTx) {
        await addTransaction({
          description: tx.description,
          amount: tx.amount,
          type: tx.type,
          category: tx.category,
          author: 'Open Finance',
          accountId: targetAcc?.id || accounts[0]?.id,
        });
      }

      setSyncStep('SUCCESS');
      if (onBankConnected) onBankConnected(selectedBank);
    } catch (err) {
      Alert.alert('Erro ao conectar', err.message || 'Falha na conexão bancária segura');
      setSyncStep(null);
    } finally {
      setConnectingBankId(null);
    }
  };

  const handleDone = () => {
    setSyncStep(null);
    setSelectedBank(null);
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerTitleWrap}>
              <View style={styles.shieldIconWrap}>
                <Ionicons name="shield-checkmark" size={18} color={COLORS.primary} />
              </View>
              <View>
                <Text style={styles.title}>Open Finance Brasil</Text>
                <Text style={styles.subtitle}>Conexão Bancária Oficial • Somente Leitura</Text>
              </View>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={20} color={COLORS.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* ESTADO 1: LISTA DE BANCOS DISPONÍVEIS */}
          {!syncStep && (
            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.infoBanner}>
                <Ionicons name="lock-closed" size={16} color={COLORS.primary} />
                <Text style={styles.infoBannerText}>
                  Acesso seguro e estritamente de <Text style={styles.boldText}>leitura</Text>. O FINN AI nunca pode fazer transferências ou movimentar seu dinheiro.
                </Text>
              </View>

              <Text style={styles.sectionHeading}>SELECIONE SEU BANCO</Text>
              <View style={styles.bankList}>
                {SUPPORTED_BANKS.map((b) => (
                  <TouchableOpacity
                    key={b.id}
                    style={styles.bankItem}
                    onPress={() => handleSelectBank(b)}
                  >
                    <View style={[styles.bankColorBadge, { backgroundColor: b.color }]}>
                      <Ionicons name={b.icon} size={20} color={COLORS.white} />
                    </View>
                    <View style={styles.bankItemInfo}>
                      <Text style={styles.bankName}>{b.name}</Text>
                      <Text style={styles.bankType}>{b.type}</Text>
                    </View>
                    <View style={styles.connectPill}>
                      <Text style={styles.connectPillText}>Conectar</Text>
                      <Ionicons name="chevron-forward" size={14} color={COLORS.primary} />
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
          )}

          {/* ESTADO 2: TERMO DE CONSENTIMENTO BANCO CENTRAL */}
          {syncStep === 'CONSENT' && selectedBank && (
            <View style={styles.stepContainer}>
              <View style={[styles.bankLogoBig, { backgroundColor: selectedBank.color }]}>
                <Ionicons name={selectedBank.icon} size={36} color={COLORS.white} />
              </View>

              <Text style={styles.stepTitle}>Conectar ao {selectedBank.name}</Text>
              <Text style={styles.stepDesc}>
                O FINN AI irá sincronizar automaticamente suas transações e saldo em modo de leitura criptografada.
              </Text>

              <View style={styles.consentBox}>
                <View style={styles.consentItem}>
                  <Ionicons name="checkmark-circle" size={18} color={COLORS.primary} />
                  <Text style={styles.consentText}>Leitura de extrato dos últimos 90 dias</Text>
                </View>
                <View style={styles.consentItem}>
                  <Ionicons name="checkmark-circle" size={18} color={COLORS.primary} />
                  <Text style={styles.consentText}>Consulta em tempo real de saldo e faturas</Text>
                </View>
                <View style={styles.consentItem}>
                  <Ionicons name="close-circle" size={18} color={COLORS.expense} />
                  <Text style={styles.consentText}>Nenhum acesso para pagamentos ou saques</Text>
                </View>
              </View>

              <View style={styles.btnRow}>
                <TouchableOpacity style={styles.cancelBtn} onPress={() => setSyncStep(null)}>
                  <Text style={styles.cancelBtnText}>Voltar</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.confirmConsentBtn} onPress={handleConfirmConsent}>
                  <Text style={styles.confirmConsentBtnText}>Autorizar Leitura</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* ESTADO 3: CONECTANDO */}
          {syncStep === 'CONNECTING' && (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={COLORS.primary} />
              <Text style={styles.loadingTitle}>Conectando ao {selectedBank?.name}...</Text>
              <Text style={styles.loadingSubtitle}>
                Criptografando chaves de segurança e importando extrato recente do casal.
              </Text>
            </View>
          )}

          {/* ESTADO 4: SUCESSO */}
          {syncStep === 'SUCCESS' && (
            <View style={styles.successContainer}>
              <View style={styles.successBadge}>
                <Ionicons name="checkmark" size={38} color={COLORS.primary} />
              </View>
              <Text style={styles.stepTitle}>{selectedBank?.name} Conectado!</Text>
              <Text style={styles.stepDesc}>
                As transações e o saldo da conta foram sincronizados com sucesso e já estão refletidos no painel financeiro do casal.
              </Text>

              <TouchableOpacity style={styles.doneBtn} onPress={handleDone}>
                <Text style={styles.doneBtnText}>Ver no Painel</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'flex-end',
  },
  card: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 24,
    maxHeight: '88%',
    borderTopWidth: 1,
    borderTopColor: COLORS.surfaceBorder,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  headerTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  shieldIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: COLORS.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: '800',
  },
  subtitle: {
    color: COLORS.textSecondary,
    fontSize: 12,
  },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: COLORS.surfaceLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    padding: 14,
    borderRadius: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.25)',
  },
  infoBannerText: {
    color: COLORS.text,
    fontSize: 12,
    flex: 1,
    lineHeight: 17,
  },
  boldText: {
    fontWeight: '800',
    color: COLORS.primary,
  },
  sectionHeading: {
    color: COLORS.textMuted,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
    marginBottom: 12,
  },
  bankList: {
    gap: 10,
    paddingBottom: 20,
  },
  bankItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surfaceLight,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.surfaceBorder,
    gap: 14,
  },
  bankColorBadge: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bankItemInfo: {
    flex: 1,
  },
  bankName: {
    color: COLORS.text,
    fontSize: 15,
    fontWeight: '700',
  },
  bankType: {
    color: COLORS.textSecondary,
    fontSize: 12,
    marginTop: 2,
  },
  connectPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: COLORS.primaryLight,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
  },
  connectPillText: {
    color: COLORS.primary,
    fontSize: 12,
    fontWeight: '700',
  },
  stepContainer: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  bankLogoBig: {
    width: 72,
    height: 72,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  stepTitle: {
    color: COLORS.text,
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 8,
    textAlign: 'center',
  },
  stepDesc: {
    color: COLORS.textSecondary,
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 19,
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  consentBox: {
    backgroundColor: COLORS.surfaceLight,
    width: '100%',
    borderRadius: 16,
    padding: 16,
    gap: 12,
    borderWidth: 1,
    borderColor: COLORS.surfaceBorder,
    marginBottom: 24,
  },
  consentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  consentText: {
    color: COLORS.text,
    fontSize: 13,
    flex: 1,
  },
  btnRow: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  cancelBtn: {
    flex: 1,
    height: 50,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.surfaceLight,
    borderWidth: 1,
    borderColor: COLORS.surfaceBorder,
  },
  cancelBtnText: {
    color: COLORS.textSecondary,
    fontWeight: '700',
    fontSize: 14,
  },
  confirmConsentBtn: {
    flex: 2,
    height: 50,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary,
  },
  confirmConsentBtnText: {
    color: COLORS.white,
    fontWeight: '800',
    fontSize: 14,
  },
  loadingContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  loadingTitle: {
    color: COLORS.text,
    fontSize: 17,
    fontWeight: '800',
    marginTop: 16,
  },
  loadingSubtitle: {
    color: COLORS.textSecondary,
    fontSize: 13,
    textAlign: 'center',
    marginTop: 6,
    paddingHorizontal: 20,
  },
  successContainer: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  successBadge: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: COLORS.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    borderWidth: 2,
    borderColor: COLORS.primary,
  },
  doneBtn: {
    backgroundColor: COLORS.primary,
    width: '100%',
    height: 50,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
  },
  doneBtnText: {
    color: COLORS.white,
    fontWeight: '800',
    fontSize: 15,
  },
});
