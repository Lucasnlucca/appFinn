import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
  Platform,
  Keyboard,
  KeyboardAvoidingView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../theme/colors';
import { useFinance } from '../context/FinanceContext';

export default function CofrinhosModal({ visible, onClose }) {
  const {
    cofrinhos,
    addCofrinho,
    depositCofrinho,
    removeCofrinho,
    askAiAboutCofrinho,
    accounts,
    hideBalances,
  } = useFinance();

  const [modalNewCof, setModalNewCof] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newTarget, setNewTarget] = useState('');
  const [newCurrent, setNewCurrent] = useState('');
  const [newDeadline, setNewDeadline] = useState('Sem prazo');
  const [newEmoji, setNewEmoji] = useState('🚗');

  // Depósito em cofrinho
  const [depositCofId, setDepositCofId] = useState(null);
  const [depositAmount, setDepositAmount] = useState('');

  // Consulta à IA
  const [aiLoadingId, setAiLoadingId] = useState(null);
  const [aiAdviceModal, setAiAdviceModal] = useState(false);
  const [currentAiAdvice, setCurrentAiAdvice] = useState('');
  const [adviceCofTitle, setAdviceCofTitle] = useState('');

  const formatMoney = (val) => {
    if (hideBalances) return 'R$ •••••••';
    return (
      'R$ ' +
      (val || 0).toLocaleString('pt-BR', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })
    );
  };

  const handleCreateCofrinho = async () => {
    if (!newTitle.trim() || !newTarget.trim()) {
      Alert.alert('Campos obrigatórios', 'Preencha o nome do cofrinho e o valor da meta.');
      return;
    }
    const target = parseFloat(newTarget.replace(',', '.'));
    const current = parseFloat((newCurrent || '0').replace(',', '.')) || 0;

    await addCofrinho({
      title: newTitle.trim(),
      targetAmount: target,
      currentAmount: current,
      deadline: newDeadline.trim() || 'Sem prazo',
      emoji: newEmoji,
    });

    setNewTitle('');
    setNewTarget('');
    setNewCurrent('');
    setModalNewCof(false);
  };

  const handleConfirmDeposit = async () => {
    if (!depositAmount.trim()) return;
    const num = parseFloat(depositAmount.replace(',', '.'));
    if (isNaN(num) || num <= 0) return;

    await depositCofrinho(depositCofId, num, accounts[0]?.id);
    setDepositAmount('');
    setDepositCofId(null);
  };

  const handleAskAi = async (cof) => {
    setAiLoadingId(cof.id);
    setAdviceCofTitle(cof.title);
    try {
      const advice = await askAiAboutCofrinho(cof.id);
      setCurrentAiAdvice(advice);
      setAiAdviceModal(true);
    } catch (e) {
      Alert.alert('Erro ao consultar IA', e.message);
    } finally {
      setAiLoadingId(null);
    }
  };

  const emojisList = ['🚗', '🏠', '✈️', '💍', '💻', '🏖️', '👶', '🎓', '🛡️', '📦'];

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheetContainer}>
          {/* Header */}
          <View style={styles.header}>
            <View>
              <Text style={styles.headerTitle}>Cofrinhos</Text>
              <Text style={styles.headerSubtitle}>
                Crie metas financeiras e acompanhe sua evolução
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={24} color={COLORS.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* Subheader com contador e botão de adicionar */}
          <View style={styles.subHeaderRow}>
            <Text style={styles.counterText}>
              {cofrinhos.length} {cofrinhos.length === 1 ? 'cofrinho ativo' : 'cofrinhos ativos'}
            </Text>
            <TouchableOpacity
              style={styles.addCofBtn}
              onPress={() => setModalNewCof(true)}
            >
              <Ionicons name="add" size={16} color={COLORS.white} />
              <Text style={styles.addCofBtnText}>Novo Cofrinho</Text>
            </TouchableOpacity>
          </View>

          {/* Lista de Cofrinhos (Design idêntico ao Print 1) */}
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 20 }}>
            {cofrinhos.length === 0 ? (
              <View style={styles.emptyBox}>
                <Ionicons name="wallet-outline" size={44} color="#64748B" />
                <Text style={styles.emptyTitle}>Nenhum cofrinho ativo ainda</Text>
                <Text style={styles.emptySub}>
                  Defina um sonho ou aquisição para a IA FINN te ajudar a poupar!
                </Text>
              </View>
            ) : (
              cofrinhos.map((cof) => {
                const target = cof.targetAmount || 1;
                const current = cof.currentAmount || 0;
                const percent = Math.min(Math.round((current / target) * 1000) / 10, 100);
                const remaining = Math.max(target - current, 0);

                return (
                  <View key={cof.id} style={styles.cofCard}>
                    {/* Linha Superior: Emoji + Nome + Prazo + Botão Excluir */}
                    <View style={styles.cofCardTop}>
                      <View style={styles.cofTitleGroup}>
                        <View style={styles.emojiCircle}>
                          <Text style={{ fontSize: 22 }}>{cof.emoji || '🎯'}</Text>
                        </View>
                        <View>
                          <Text style={styles.cofTitle}>{cof.title}</Text>
                          <Text style={styles.cofDeadline}>{cof.deadline || 'Sem prazo'}</Text>
                        </View>
                      </View>

                      <View style={styles.actionsTopRow}>
                        <TouchableOpacity
                          style={styles.iconMiniBtn}
                          onPress={() => {
                            Alert.alert('Excluir cofrinho', `Deseja remover "${cof.title}"?`, [
                              { text: 'Cancelar', style: 'cancel' },
                              { text: 'Excluir', style: 'destructive', onPress: () => removeCofrinho(cof.id) },
                            ]);
                          }}
                        >
                          <Ionicons name="trash-outline" size={16} color="#94A3B8" />
                        </TouchableOpacity>
                      </View>
                    </View>

                    {/* Valores: R$ 41.000,00 de R$ 80.000,00 */}
                    <View style={styles.amountNumbersRow}>
                      <Text style={styles.currentAmountText}>{formatMoney(current)}</Text>
                      <Text style={styles.targetAmountText}>de {formatMoney(target)}</Text>
                    </View>

                    {/* Barra de Progresso Ciano (Print 1) */}
                    <View style={styles.progressTrack}>
                      <View style={[styles.progressFill, { width: `${percent}%` }]} />
                    </View>

                    {/* % atingido e Falta R$ X */}
                    <View style={styles.progressFooterRow}>
                      <Text style={styles.percentText}>{percent.toFixed(1)}% atingido</Text>
                      <Text style={styles.remainingText}>Falta {formatMoney(remaining)}</Text>
                    </View>

                    {/* Botões de Ação do Cofrinho */}
                    <View style={styles.cofCardActions}>
                      <TouchableOpacity
                        style={styles.depositBtn}
                        onPress={() => setDepositCofId(cof.id)}
                      >
                        <Ionicons name="add-circle-outline" size={15} color={COLORS.white} />
                        <Text style={styles.depositBtnText}>Guardar Dinheiro</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={styles.aiConsultBtn}
                        onPress={() => handleAskAi(cof)}
                        disabled={aiLoadingId === cof.id}
                      >
                        {aiLoadingId === cof.id ? (
                          <ActivityIndicator size="small" color="#06B6D4" />
                        ) : (
                          <>
                            <Ionicons name="sparkles" size={15} color="#06B6D4" />
                            <Text style={styles.aiConsultBtnText}>Onde Economizar?</Text>
                          </>
                        )}
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })
            )}
          </ScrollView>
        </View>
      </View>

      {/* MODAL PARA ADICIONAR NOVO COFRINHO */}
      <Modal
        visible={modalNewCof}
        transparent
        animationType="fade"
        onRequestClose={() => setModalNewCof(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.centerOverlay}
        >
          <TouchableOpacity
            style={{ flex: 1, width: '100%', justifyContent: 'center', alignItems: 'center' }}
            activeOpacity={1}
            onPress={Keyboard.dismiss}
          >
            <TouchableWithoutFeedback>
              <View style={[styles.dialogBox, { maxHeight: '88%' }]}>
                <Text style={styles.dialogTitle}>Novo Cofrinho de Metas</Text>
                <Text style={styles.dialogSubtitle}>
                  O que você e seu cônjuge desejam adquirir ou planejar?
                </Text>

                <ScrollView
                  keyboardShouldPersistTaps="handled"
                  showsVerticalScrollIndicator={false}
                  bounces={false}
                >
                  {/* Seletor de Emoji */}
                  <Text style={styles.miniLabel}>Ícone da Meta:</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
                    {emojisList.map((em) => (
                      <TouchableOpacity
                        key={em}
                        style={[styles.emojiPickBtn, newEmoji === em && styles.emojiPickBtnActive]}
                        onPress={() => setNewEmoji(em)}
                      >
                        <Text style={{ fontSize: 20 }}>{em}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>

                  <Text style={styles.miniLabel}>Nome da Meta (ex: Carro, Viagem):</Text>
                  <TextInput
                    style={styles.dialogInput}
                    placeholder="Ex: Troca de Carro, Reforma"
                    placeholderTextColor="#64748B"
                    value={newTitle}
                    onChangeText={setNewTitle}
                  />

                  <Text style={styles.miniLabel}>Valor Alvo Total (R$):</Text>
                  <TextInput
                    style={styles.dialogInput}
                    placeholder="Ex: 80.000,00"
                    placeholderTextColor="#64748B"
                    keyboardType="decimal-pad"
                    value={newTarget}
                    onChangeText={setNewTarget}
                  />

                  <Text style={styles.miniLabel}>Valor que já temos guardado (R$):</Text>
                  <TextInput
                    style={styles.dialogInput}
                    placeholder="Ex: 41.000,00 (ou 0 se for começar)"
                    placeholderTextColor="#64748B"
                    keyboardType="decimal-pad"
                    value={newCurrent}
                    onChangeText={setNewCurrent}
                  />

                  <Text style={styles.miniLabel}>Prazo desejado (opcional):</Text>
                  <TextInput
                    style={styles.dialogInput}
                    placeholder="Ex: Dezembro 2026, ou Sem prazo"
                    placeholderTextColor="#64748B"
                    value={newDeadline}
                    onChangeText={setNewDeadline}
                  />

                  <View style={styles.dialogButtonsRow}>
                    <TouchableOpacity
                      style={styles.cancelBtn}
                      onPress={() => setModalNewCof(false)}
                    >
                      <Text style={styles.cancelBtnText}>Cancelar</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.confirmCofBtn}
                      onPress={handleCreateCofrinho}
                    >
                      <Text style={styles.confirmCofBtnText}>Criar Cofrinho</Text>
                    </TouchableOpacity>
                  </View>
                </ScrollView>
              </View>
            </TouchableWithoutFeedback>
          </TouchableOpacity>
        </KeyboardAvoidingView>
      </Modal>

      {/* MODAL DE DEPÓSITO NO COFRINHO */}
      <Modal
        visible={!!depositCofId}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setDepositAmount('');
          setDepositCofId(null);
        }}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.centerOverlay}
        >
          <TouchableOpacity
            style={{ flex: 1, width: '100%', justifyContent: 'center', alignItems: 'center' }}
            activeOpacity={1}
            onPress={Keyboard.dismiss}
          >
            <TouchableWithoutFeedback>
              <View style={styles.dialogBox}>
                <Text style={styles.dialogTitle}>Guardar no Cofrinho</Text>
                <Text style={styles.dialogSubtitle}>Quanto você deseja destinar para esta meta agora?</Text>

                <View style={styles.depositInputRow}>
                  <Text style={styles.depositPrefix}>R$</Text>
                  <TextInput
                    style={styles.depositInput}
                    placeholder="500,00"
                    placeholderTextColor="#64748B"
                    keyboardType="decimal-pad"
                    value={depositAmount}
                    onChangeText={setDepositAmount}
                    autoFocus
                  />
                </View>

                <View style={styles.dialogButtonsRow}>
                  <TouchableOpacity
                    style={styles.cancelBtn}
                    onPress={() => {
                      setDepositAmount('');
                      setDepositCofId(null);
                    }}
                  >
                    <Text style={styles.cancelBtnText}>Cancelar</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.confirmCofBtn}
                    onPress={handleConfirmDeposit}
                  >
                    <Text style={styles.confirmCofBtnText}>Guardar</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </TouchableWithoutFeedback>
          </TouchableOpacity>
        </KeyboardAvoidingView>
      </Modal>

      {/* MODAL DE RESPOSTA DA IA COM DICAS DE ECONOMIA */}
      <Modal visible={aiAdviceModal} transparent animationType="slide">
        <View style={styles.centerOverlay}>
          <View style={[styles.dialogBox, { maxHeight: '80%' }]}>
            <View style={styles.aiAdviceHeader}>
              <View style={styles.aiBadgeSparkle}>
                <Ionicons name="sparkles" size={18} color="#06B6D4" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.aiAdviceHeaderTitle}>Plano da IA FINN</Text>
                <Text style={styles.aiAdviceHeaderSub}>Meta: {adviceCofTitle}</Text>
              </View>
              <TouchableOpacity onPress={() => setAiAdviceModal(false)}>
                <Ionicons name="close" size={24} color="#94A3B8" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={{ marginVertical: 10 }}>
              <Text style={styles.aiAdviceText}>{currentAiAdvice}</Text>
            </ScrollView>

            <TouchableOpacity
              style={styles.aiAdviceCloseBtn}
              onPress={() => setAiAdviceModal(false)}
            >
              <Text style={styles.aiAdviceCloseBtnText}>Entendi, vamos colocar em prática!</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    backgroundColor: '#0F1318',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 40,
    maxHeight: '92%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  headerTitle: {
    color: COLORS.white,
    fontSize: 22,
    fontWeight: '900',
  },
  headerSubtitle: {
    color: '#94A3B8',
    fontSize: 13,
    marginTop: 2,
  },
  closeBtn: {
    padding: 6,
  },
  subHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#1E232A',
    marginBottom: 16,
  },
  counterText: {
    color: '#CBD5E1',
    fontSize: 14,
    fontWeight: '600',
  },
  addCofBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#0E2F5A',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#2563EB',
  },
  addCofBtnText: {
    color: COLORS.white,
    fontSize: 13,
    fontWeight: '700',
  },
  emptyBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    gap: 10,
  },
  emptyTitle: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: '700',
  },
  emptySub: {
    color: '#64748B',
    fontSize: 13,
    textAlign: 'center',
    paddingHorizontal: 30,
  },
  cofCard: {
    backgroundColor: '#1E232A',
    borderRadius: 18,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#2A313C',
  },
  cofCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  cofTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  emojiCircle: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#13171D',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#2A313C',
  },
  cofTitle: {
    color: COLORS.white,
    fontSize: 17,
    fontWeight: '800',
  },
  cofDeadline: {
    color: '#94A3B8',
    fontSize: 12,
    marginTop: 2,
  },
  actionsTopRow: {
    flexDirection: 'row',
    gap: 8,
  },
  iconMiniBtn: {
    padding: 6,
  },
  amountNumbersRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
    marginBottom: 10,
  },
  currentAmountText: {
    color: COLORS.white,
    fontSize: 22,
    fontWeight: '900',
  },
  targetAmountText: {
    color: '#94A3B8',
    fontSize: 13,
    fontWeight: '600',
  },
  progressTrack: {
    height: 8,
    backgroundColor: '#13171D',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#06B6D4',
    borderRadius: 4,
  },
  progressFooterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  percentText: {
    color: '#06B6D4',
    fontSize: 12,
    fontWeight: '700',
  },
  remainingText: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '600',
  },
  cofCardActions: {
    flexDirection: 'row',
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: '#2A313C',
    paddingTop: 12,
  },
  depositBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#0E2F5A',
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#2563EB',
  },
  depositBtnText: {
    color: COLORS.white,
    fontSize: 13,
    fontWeight: '700',
  },
  aiConsultBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#13171D',
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#06B6D4',
  },
  aiConsultBtnText: {
    color: '#06B6D4',
    fontSize: 13,
    fontWeight: '700',
  },
  centerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  dialogBox: {
    width: '100%',
    backgroundColor: '#1E232A',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: '#2A313C',
  },
  dialogTitle: {
    color: COLORS.white,
    fontSize: 18,
    fontWeight: '800',
  },
  dialogSubtitle: {
    color: '#94A3B8',
    fontSize: 12,
    marginTop: 4,
    marginBottom: 14,
  },
  miniLabel: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 4,
  },
  dialogInput: {
    backgroundColor: '#13171D',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: COLORS.white,
    fontSize: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#2A313C',
  },
  emojiPickBtn: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#13171D',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#2A313C',
  },
  emojiPickBtnActive: {
    backgroundColor: '#0E2F5A',
    borderColor: '#06B6D4',
  },
  dialogButtonsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 10,
  },
  cancelBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#13171D',
  },
  cancelBtnText: {
    color: '#94A3B8',
    fontSize: 14,
    fontWeight: '600',
  },
  confirmCofBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#06B6D4',
  },
  confirmCofBtnText: {
    color: '#0F172A',
    fontSize: 14,
    fontWeight: '800',
  },
  depositInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#13171D',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginVertical: 14,
    borderWidth: 1,
    borderColor: '#2A313C',
  },
  depositPrefix: {
    color: '#94A3B8',
    fontSize: 20,
    fontWeight: '700',
    marginRight: 8,
  },
  depositInput: {
    flex: 1,
    color: COLORS.white,
    fontSize: 22,
    fontWeight: '800',
  },
  aiAdviceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#2A313C',
  },
  aiBadgeSparkle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(6, 182, 212, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  aiAdviceHeaderTitle: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: '800',
  },
  aiAdviceHeaderSub: {
    color: '#06B6D4',
    fontSize: 12,
    fontWeight: '600',
  },
  aiAdviceText: {
    color: '#E2E8F0',
    fontSize: 14,
    lineHeight: 22,
    paddingVertical: 8,
  },
  aiAdviceCloseBtn: {
    backgroundColor: '#0E2F5A',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2563EB',
    marginTop: 8,
  },
  aiAdviceCloseBtnText: {
    color: COLORS.white,
    fontSize: 14,
    fontWeight: '700',
  },
});

