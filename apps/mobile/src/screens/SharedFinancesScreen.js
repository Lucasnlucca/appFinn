import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  Alert,
  StatusBar,
  Share,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS } from '../theme/colors';
import { useFinance, CATEGORIES } from '../context/FinanceContext';

export default function SharedFinancesScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const {
    loggedInUser,
    members,
    sharedGroups,
    activeGroupId,
    setActiveGroupId,
    createSharedGroup,
    deleteSharedGroup,
    invitePersonToGroup,
    acceptGroupInvitation,
    groupInvitations,
    settlements,
    recordSettlement,
    addSharedExpense,
    transactions,
    viewMode,
    setViewMode,
  } = useFinance();

  // Abas: 'dashboard' | 'acertos' | 'membros'
  const [activeTab, setActiveTab] = useState('dashboard');

  // Modais
  const [modalNewGroup, setModalNewGroup] = useState(false);
  const [modalInvite, setModalInvite] = useState(false);
  const [modalJoin, setModalJoin] = useState(false);
  const [modalNewExpense, setModalNewExpense] = useState(false);
  const [modalSettlement, setModalSettlement] = useState(false);

  // Formulário Novo Grupo
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupType, setNewGroupType] = useState('Casal');
  const [newGroupDesc, setNewGroupDesc] = useState('');

  // Formulário Convidar
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteType, setInviteType] = useState('Casal');
  const [inviteMessage, setInviteMessage] = useState('');

  // Formulário Entrar com Código
  const [joinCode, setJoinCode] = useState('');

  // Formulário Despesa Compartilhada
  const [expDesc, setExpDesc] = useState('');
  const [expAmount, setExpAmount] = useState('');
  const [expCategory, setExpCategory] = useState('alimentacao');
  const [expPaidBy, setExpPaidBy] = useState(loggedInUser?.name || 'Você');
  const [expSplitMethod, setExpSplitMethod] = useState('equal'); // 'equal' | 'percentage' | 'exact'
  const [customSharePercent, setCustomSharePercent] = useState('50');

  // Formulário Acerto de Contas
  const [settleFrom, setSettleFrom] = useState('');
  const [settleTo, setSettleTo] = useState('');
  const [settleAmount, setSettleAmount] = useState('');
  const [settleNotes, setSettleNotes] = useState('');

  const activeGroup = useMemo(() => {
    return sharedGroups.find((g) => g.id === activeGroupId) || sharedGroups[0] || null;
  }, [sharedGroups, activeGroupId]);

  const groupMembers = useMemo(() => {
    if (activeGroup?.members && activeGroup.members.length > 0) {
      return activeGroup.members;
    }
    const currentName = loggedInUser?.name || loggedInUser?.fullName || 'Você';
    return [
      { id: loggedInUser?.id || 'm1', name: currentName, role: 'ADMIN' },
    ];
  }, [activeGroup, loggedInUser]);

  // Transações compartilhadas do grupo (100% isoladas para o grupo ativo)
  const sharedTxs = useMemo(() => {
    if (!activeGroup?.id) return [];
    return transactions.filter(
      (t) => t.isShared && (t.groupId === activeGroup.id || t.sharedGroupId === activeGroup.id)
    );
  }, [transactions, activeGroup?.id]);

  // Total gasto compartilhado no mês
  const totalSharedSpent = useMemo(() => {
    return sharedTxs.reduce((sum, t) => sum + (t.amount || 0), 0);
  }, [sharedTxs]);

  // Cálculo de Acerto de Contas (Quem deve para quem)
  const debtsCalculation = useMemo(() => {
    const member1 = groupMembers[0]?.name || (loggedInUser?.name || 'Você');
    const member2 = groupMembers[1]?.name || 'Participante';

    let netOwed = 0; // Se positivo: member2 deve para member1. Se negativo: member1 deve para member2.

    sharedTxs.forEach((tx) => {
      const half = (tx.amount || 0) / 2;
      if (tx.paidBy === member1) {
        netOwed += half;
      } else if (tx.paidBy === member2) {
        netOwed -= half;
      }
    });

    // Subtrai acertos já realizados e confirmados
    settlements.forEach((s) => {
      if (s.fromMember === member2 && s.toMember === member1) {
        netOwed -= s.amount || 0;
      } else if (s.fromMember === member1 && s.toMember === member2) {
        netOwed += s.amount || 0;
      }
    });

    return {
      member1,
      member2,
      netOwed: Math.round(netOwed * 100) / 100,
    };
  }, [sharedTxs, settlements, groupMembers]);

  const formatMoney = (val) => {
    return (
      'R$ ' +
      (val || 0).toLocaleString('pt-BR', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })
    );
  };

  // 1. Criar Grupo
  const handleCreateGroup = async () => {
    if (!newGroupName.trim()) {
      Alert.alert('Atenção', 'Informe o nome do grupo.');
      return;
    }
    try {
      await createSharedGroup({
        name: newGroupName.trim(),
        type: newGroupType,
        description: newGroupDesc.trim(),
      });
      setModalNewGroup(false);
      setNewGroupName('');
      setNewGroupDesc('');
      Alert.alert('Sucesso', 'Grupo de finanças compartilhado criado com sucesso!');
    } catch (e) {
      Alert.alert('Erro', e.message);
    }
  };

  // 2. Convidar Pessoa
  const handleInvite = async () => {
    if (!inviteEmail.trim() || !inviteEmail.includes('@')) {
      Alert.alert('Atenção', 'Digite um e-mail válido.');
      return;
    }
    try {
      const inv = await invitePersonToGroup({
        groupId: activeGroup?.id,
        email: inviteEmail.trim(),
        type: inviteType,
        message: inviteMessage.trim(),
      });
      setModalInvite(false);
      setInviteEmail('');
      setInviteMessage('');

      Alert.alert(
        'Convite Gerado!',
        `Código de Acesso: ${inv.token}\n\nEnvie este código para a outra pessoa aceitar no app FINN.`,
        [
          { text: 'OK' },
          {
            text: 'Compartilhar Link',
            onPress: () => {
              Share.share({
                message: `Olá! Estou te convidando para compartilhar finanças no FINN. Baixe o app e use o código de convite: ${inv.token}`,
              });
            },
          },
        ]
      );
    } catch (e) {
      Alert.alert('Erro ao convidar', e.message);
    }
  };

  // 3. Entrar com Código
  const handleJoin = async () => {
    if (!joinCode.trim()) {
      Alert.alert('Atenção', 'Informe o código do convite.');
      return;
    }
    try {
      await acceptGroupInvitation(joinCode.trim());
      setModalJoin(false);
      setJoinCode('');
      Alert.alert('Sucesso', 'Você ingressou no grupo financeiro com sucesso!');
    } catch (e) {
      Alert.alert('Erro ao aceitar convite', e.message);
    }
  };

  // 4. Salvar Despesa Compartilhada
  const handleSaveSharedExpense = async () => {
    if (!expDesc.trim() || !expAmount) {
      Alert.alert('Atenção', 'Preencha a descrição e o valor.');
      return;
    }
    const num = parseFloat(expAmount.replace(',', '.'));
    if (isNaN(num) || num <= 0) {
      Alert.alert('Atenção', 'Valor inválido.');
      return;
    }

    try {
      await addSharedExpense({
        description: expDesc.trim(),
        amount: num,
        category: expCategory,
        paidBy: expPaidBy,
        splitMethod: expSplitMethod,
        groupId: activeGroup?.id,
      });

      setModalNewExpense(false);
      setExpDesc('');
      setExpAmount('');
      Alert.alert('Lançado!', 'Despesa compartilhada registrada com divisão calculada.');
    } catch (e) {
      Alert.alert('Erro', e.message);
    }
  };

  // Excluir Grupo
  const handleDeleteGroup = (groupId) => {
    if (sharedGroups.length <= 1) {
      Alert.alert('Atenção', 'Você precisa manter pelo menos um grupo ativo.');
      return;
    }
    Alert.alert(
      'Excluir Grupo',
      `Tem certeza que deseja excluir o grupo "${activeGroup?.name}"? Esta ação removerá o grupo da sua conta.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Excluir',
          style: 'destructive',
          onPress: async () => {
            if (deleteSharedGroup) {
              await deleteSharedGroup(groupId);
              Alert.alert('Sucesso', 'Grupo excluído com sucesso.');
            }
          },
        },
      ]
    );
  };

  // 5. Salvar Acerto de Contas
  const handleSaveSettlement = async () => {
    const num = parseFloat(settleAmount.replace(',', '.'));
    if (isNaN(num) || num <= 0) {
      Alert.alert('Atenção', 'Informe um valor válido.');
      return;
    }
    try {
      await recordSettlement({
        groupId: activeGroup?.id,
        fromMember: settleFrom || debtsCalculation.member2,
        toMember: settleTo || debtsCalculation.member1,
        amount: num,
        notes: settleNotes.trim(),
      });
      setModalSettlement(false);
      setSettleAmount('');
      setSettleNotes('');
      Alert.alert('Acerto Registrado', 'O pagamento foi confirmado e a dívida abatida!');
    } catch (e) {
      Alert.alert('Erro', e.message);
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="dark-content" backgroundColor="#F7F5FC" />

      {/* CABEÇALHO COM VOLTAR, TÍTULO E AÇÃO DE CRIAR / CONVIDAR */}
      <View style={styles.topHeader}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => navigation?.goBack?.()}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back" size={24} color="#18181B" />
        </TouchableOpacity>

        <View style={styles.headerTitleWrap}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {activeGroup?.name || 'Finanças Compartilhadas'}
          </Text>
          <Text style={styles.headerSubtitle}>
            {activeGroup ? `${groupMembers.length} participante${groupMembers.length > 1 ? 's' : ''} • ${activeGroup.type}` : 'Gestão conjunta'}
          </Text>
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <TouchableOpacity
            style={styles.headerActionPill}
            onPress={() => setModalNewGroup(true)}
            activeOpacity={0.8}
          >
            <Ionicons name="add" size={17} color="#7C3AED" />
            <Text style={styles.headerActionPillText}>Novo</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.inviteHeaderBtn}
            onPress={() => setModalInvite(true)}
            activeOpacity={0.8}
          >
            <Ionicons name="person-add" size={16} color="#7C3AED" />
          </TouchableOpacity>
        </View>
      </View>

      {/* SELETOR HORIZONTAL DE TODOS OS GRUPOS (PERMITE TROCAR E ADICIONAR MAIS GRUPOS) */}
      {sharedGroups.length > 0 && (
        <View style={styles.groupsSelectorWrap}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.groupsSelectorScroll}
          >
            {sharedGroups.map((grp) => {
              const isSelected = grp.id === activeGroup?.id;
              const count = grp.members?.length || 1;
              return (
                <TouchableOpacity
                  key={grp.id}
                  style={[styles.groupChip, isSelected && styles.groupChipActive]}
                  onPress={() => setActiveGroupId(grp.id)}
                  activeOpacity={0.8}
                >
                  <Ionicons
                    name={grp.type === 'Casal' ? 'heart' : 'people'}
                    size={14}
                    color={isSelected ? '#FFFFFF' : '#7C3AED'}
                  />
                  <Text
                    style={[styles.groupChipText, isSelected && styles.groupChipTextActive]}
                    numberOfLines={1}
                  >
                    {grp.name}
                  </Text>
                  <View style={[styles.groupChipBadge, isSelected && styles.groupChipBadgeActive]}>
                    <Text style={[styles.groupChipBadgeText, isSelected && styles.groupChipBadgeTextActive]}>
                      {count}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}

            <TouchableOpacity
              style={styles.addGroupChip}
              onPress={() => setModalNewGroup(true)}
              activeOpacity={0.8}
            >
              <Ionicons name="add-circle-outline" size={16} color="#7C3AED" />
              <Text style={styles.addGroupChipText}>+ Criar grupo</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      )}

      {/* SE O USUÁRIO AINDA NÃO TEM GRUPO: TELA DE PRIMEIRO ACESSO */}
      {sharedGroups.length === 0 ? (
        <ScrollView contentContainerStyle={styles.firstAccessWrap}>
          <LinearGradient
            colors={['#7C3AED', '#9333EA', '#A855F7']}
            style={styles.firstAccessHero}
          >
            <View style={styles.heroIconCircle}>
              <Ionicons name="people" size={36} color="#7C3AED" />
            </View>
            <Text style={styles.firstAccessTitle}>Organize suas finanças em conjunto.</Text>
            <Text style={styles.firstAccessSub}>
              Convide alguém para compartilhar despesas, acompanhar contas conjuntas e planejar objetivos financeiros mantendo a privacidade de cada um.
            </Text>
          </LinearGradient>

          <View style={styles.firstAccessCardsRow}>
            <View style={styles.featureCard}>
              <Ionicons name="shield-checkmark-outline" size={24} color="#7C3AED" />
              <Text style={styles.featureTitle}>Privacidade Total</Text>
              <Text style={styles.featureDesc}>
                Suas despesas particulares continuam 100% invisíveis para a outra pessoa.
              </Text>
            </View>

            <View style={styles.featureCard}>
              <Ionicons name="calculator-outline" size={24} color="#10B981" />
              <Text style={styles.featureTitle}>Divisão Inteligente</Text>
              <Text style={styles.featureDesc}>
                Divisão igualitária ou percentual sem complicação nem planilhas manuais.
              </Text>
            </View>
          </View>

          <View style={styles.firstAccessActions}>
            <TouchableOpacity
              style={styles.primaryActionBtn}
              onPress={() => setModalNewGroup(true)}
              activeOpacity={0.85}
            >
              <Ionicons name="add-circle-outline" size={20} color="#FFFFFF" />
              <Text style={styles.primaryActionBtnText}>Criar grupo</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.secondaryActionBtn}
              onPress={() => setModalJoin(true)}
              activeOpacity={0.85}
            >
              <Ionicons name="key-outline" size={20} color="#7C3AED" />
              <Text style={styles.secondaryActionBtnText}>Tenho um convite</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      ) : (
        <>
          {/* ABAS DO MÓDULO: DASHBOARD | ACERTO DE CONTAS | MEMBROS */}
          <View style={styles.tabsRow}>
            <TouchableOpacity
              style={[styles.tabBtn, activeTab === 'dashboard' && styles.tabBtnActive]}
              onPress={() => setActiveTab('dashboard')}
            >
              <Text style={[styles.tabBtnText, activeTab === 'dashboard' && styles.tabBtnTextActive]}>
                Painel
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.tabBtn, activeTab === 'acertos' && styles.tabBtnActive]}
              onPress={() => setActiveTab('acertos')}
            >
              <Text style={[styles.tabBtnText, activeTab === 'acertos' && styles.tabBtnTextActive]}>
                Acerto de Contas
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.tabBtn, activeTab === 'membros' && styles.tabBtnActive]}
              onPress={() => setActiveTab('membros')}
            >
              <Text style={[styles.tabBtnText, activeTab === 'membros' && styles.tabBtnTextActive]}>
                Participantes ({groupMembers.length})
              </Text>
            </TouchableOpacity>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={[styles.contentScroll, { paddingBottom: insets.bottom + 40 }]}
          >
            {/* ============================================================== */}
            {/* ABA 1: PAINEL / DASHBOARD                                      */}
            {/* ============================================================== */}
            {activeTab === 'dashboard' && (
              <>
                {/* CARD RESUMO PRINCIPAL DO GRUPO */}
                <LinearGradient
                  colors={['#7C3AED', '#9333EA']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.summaryCard}
                >
                  <View style={styles.summaryTopRow}>
                    <Text style={styles.summaryLabel}>Total compartilhado este mês</Text>
                    <View style={styles.badgeGroupType}>
                      <Text style={styles.badgeGroupTypeText}>{activeGroup?.type || 'Casal'}</Text>
                    </View>
                  </View>
                  <Text style={styles.summaryValue}>{formatMoney(totalSharedSpent)}</Text>

                  {/* Divisão Rápida entre Participantes */}
                  <View style={styles.splitsSummaryRow}>
                    {groupMembers.map((m, idx) => (
                      <View key={m.id || idx} style={styles.memberSharePill}>
                        <Ionicons name="person" size={13} color="#FFFFFF" />
                        <Text style={styles.memberShareText}>
                          {m.name}: {formatMoney(totalSharedSpent / groupMembers.length)}
                        </Text>
                      </View>
                    ))}
                  </View>
                </LinearGradient>

                {/* CARD DE DESTAQUE: ACERTO RÁPIDO */}
                <View style={styles.quickDebtsCard}>
                  <View style={styles.quickDebtsIconCircle}>
                    <Ionicons name="swap-horizontal" size={20} color="#7C3AED" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.quickDebtsTitle}>Situação de Acerto</Text>
                    <Text style={styles.quickDebtsDesc}>
                      {debtsCalculation.netOwed > 0
                        ? `${debtsCalculation.member2} deve ${formatMoney(debtsCalculation.netOwed)} para ${debtsCalculation.member1}`
                        : debtsCalculation.netOwed < 0
                        ? `${debtsCalculation.member1} deve ${formatMoney(Math.abs(debtsCalculation.netOwed))} para ${debtsCalculation.member2}`
                        : 'Tudo acertado! Ninguém deve nada no momento. 🎉'}
                    </Text>
                  </View>
                  {debtsCalculation.netOwed !== 0 && (
                    <TouchableOpacity
                      style={styles.btnPagarPill}
                      onPress={() => {
                        setSettleAmount(String(Math.abs(debtsCalculation.netOwed)));
                        setModalSettlement(true);
                      }}
                    >
                      <Text style={styles.btnPagarPillText}>Acertar</Text>
                    </TouchableOpacity>
                  )}
                </View>

                {/* BOTÃO ADICIONAR DESPESA COMPARTILHADA */}
                <TouchableOpacity
                  style={styles.btnNovaDespesa}
                  onPress={() => setModalNewExpense(true)}
                  activeOpacity={0.85}
                >
                  <Ionicons name="add-circle" size={20} color="#FFFFFF" />
                  <Text style={styles.btnNovaDespesaText}>Lançar despesa compartilhada</Text>
                </TouchableOpacity>

                {/* HISTÓRICO DE DESPESAS COMPARTILHADAS */}
                <Text style={styles.sectionTitle}>Despesas do grupo ({sharedTxs.length})</Text>

                {sharedTxs.length === 0 ? (
                  <View style={styles.emptyBox}>
                    <Ionicons name="receipt-outline" size={36} color="#D1D5DB" />
                    <Text style={styles.emptyTitle}>Nenhuma despesa compartilhada ainda</Text>
                    <Text style={styles.emptySub}>
                      Toque no botão acima para registrar um gasto de mercado, restaurante ou moradia dividido entre vocês.
                    </Text>
                  </View>
                ) : (
                  sharedTxs.map((t) => (
                    <View key={t.id} style={styles.txSharedCard}>
                      <View style={styles.txSharedLeft}>
                        <View style={styles.txCategoryIcon}>
                          <Ionicons name="cart-outline" size={18} color="#7C3AED" />
                        </View>
                        <View>
                          <Text style={styles.txSharedDesc}>{t.description}</Text>
                          <Text style={styles.txSharedMeta}>
                            Pago por {t.paidBy || 'Você'} • Dividido igual
                          </Text>
                        </View>
                      </View>
                      <View style={{ alignItems: 'flex-end' }}>
                        <Text style={styles.txSharedAmount}>{formatMoney(t.amount)}</Text>
                        <Text style={styles.txSharedEach}>
                          {formatMoney((t.amount || 0) / 2)} cada
                        </Text>
                      </View>
                    </View>
                  ))
                )}
              </>
            )}

            {/* ============================================================== */}
            {/* ABA 2: ACERTO DE CONTAS                                        */}
            {/* ============================================================== */}
            {activeTab === 'acertos' && (
              <>
                <View style={styles.acertoHeroBox}>
                  <Text style={styles.acertoHeroLabel}>Balanço de Débitos e Créditos</Text>
                  <Text style={styles.acertoHeroValue}>
                    {formatMoney(Math.abs(debtsCalculation.netOwed))}
                  </Text>
                  <Text style={styles.acertoHeroSub}>
                    {debtsCalculation.netOwed > 0
                      ? `${debtsCalculation.member2} deve para ${debtsCalculation.member1}`
                      : debtsCalculation.netOwed < 0
                      ? `${debtsCalculation.member1} deve para ${debtsCalculation.member2}`
                      : 'Contas 100% equilibradas'}
                  </Text>

                  <TouchableOpacity
                    style={styles.acertoPayBtn}
                    onPress={() => {
                      setSettleAmount(String(Math.abs(debtsCalculation.netOwed || 50)));
                      setModalSettlement(true);
                    }}
                  >
                    <Ionicons name="checkmark-done-circle-outline" size={18} color="#FFFFFF" />
                    <Text style={styles.acertoPayBtnText}>Registrar Acerto / Liquidação</Text>
                  </TouchableOpacity>
                </View>

                {/* HISTÓRICO DE ACERTOS */}
                <Text style={styles.sectionTitle}>Histórico de liquidações ({settlements.length})</Text>

                {settlements.length === 0 ? (
                  <View style={styles.emptyBox}>
                    <Ionicons name="time-outline" size={36} color="#D1D5DB" />
                    <Text style={styles.emptyTitle}>Nenhum acerto registrado</Text>
                    <Text style={styles.emptySub}>
                      Quando alguém transferir via PIX para abater a divisão, registre aqui para zerar o saldo.
                    </Text>
                  </View>
                ) : (
                  settlements.map((s) => (
                    <View key={s.id} style={styles.settlementRow}>
                      <View style={styles.settlementIconBox}>
                        <Ionicons name="checkmark-circle" size={20} color="#10B981" />
                      </View>
                      <View style={{ flex: 1, marginHorizontal: 10 }}>
                        <Text style={styles.settlementTitle}>
                          {s.fromMember} pagou {s.toMember}
                        </Text>
                        <Text style={styles.settlementDate}>{s.date} • Confirmado</Text>
                      </View>
                      <Text style={styles.settlementAmount}>{formatMoney(s.amount)}</Text>
                    </View>
                  ))
                )}
              </>
            )}

            {/* ============================================================== */}
            {/* ABA 3: PARTICIPANTES & CONVITES                                */}
            {/* ============================================================== */}
            {activeTab === 'membros' && (
              <>
                <View style={styles.groupInfoCard}>
                  <Text style={styles.groupInfoTitle}>{activeGroup?.name}</Text>
                  <Text style={styles.groupInfoSub}>{activeGroup?.description || 'Espaço de finanças compartilhadas'}</Text>
                  <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
                    <TouchableOpacity
                      style={styles.btnConvidarNovo}
                      onPress={() => setModalInvite(true)}
                    >
                      <Ionicons name="mail-outline" size={16} color="#7C3AED" />
                      <Text style={styles.btnConvidarNovoText}>Convidar membro</Text>
                    </TouchableOpacity>

                    {sharedGroups.length > 1 && (
                      <TouchableOpacity
                        style={styles.btnExcluirGrupo}
                        onPress={() => handleDeleteGroup(activeGroup?.id)}
                      >
                        <Ionicons name="trash-outline" size={16} color="#EF4444" />
                        <Text style={styles.btnExcluirGrupoText}>Excluir</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>

                <Text style={styles.sectionTitle}>Membros ativos ({groupMembers.length})</Text>
                {groupMembers.map((m, idx) => (
                  <View key={m.id || idx} style={styles.memberCardRow}>
                    <View style={styles.memberAvatar}>
                      <Text style={styles.memberAvatarText}>{m.name.charAt(0)}</Text>
                    </View>
                    <View style={{ flex: 1, marginHorizontal: 12 }}>
                      <Text style={styles.memberName}>{m.name}</Text>
                      <Text style={styles.memberRole}>
                        {m.role === 'ADMIN' ? 'Administrador(a)' : 'Participante'}
                      </Text>
                    </View>
                    <View style={styles.memberBadgeActive}>
                      <Text style={styles.memberBadgeActiveText}>Ativo</Text>
                    </View>
                  </View>
                ))}

                {/* CONVITES PENDENTES */}
                <Text style={[styles.sectionTitle, { marginTop: 24 }]}>
                  Convites Enviados ({groupInvitations.length})
                </Text>
                {groupInvitations.length === 0 ? (
                  <Text style={styles.emptySimpleText}>Nenhum convite pendente no momento.</Text>
                ) : (
                  groupInvitations.map((inv) => (
                    <View key={inv.id} style={styles.invitationRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.invEmail}>{inv.email}</Text>
                        <Text style={styles.invMeta}>
                          Código: {inv.token} • {inv.status === 'PENDING' ? 'Aguardando aceite' : 'Aceito'}
                        </Text>
                      </View>
                      <TouchableOpacity
                        style={styles.btnCopyLink}
                        onPress={() => {
                          Share.share({
                            message: `Entre no meu grupo FINN com o código: ${inv.token}`,
                          });
                        }}
                      >
                        <Ionicons name="share-social-outline" size={16} color="#7C3AED" />
                      </TouchableOpacity>
                    </View>
                  ))
                )}
              </>
            )}
          </ScrollView>
        </>
      )}

      {/* ============================================================== */}
      {/* MODAL 1: CRIAR GRUPO                                           */}
      {/* ============================================================== */}
      <Modal visible={modalNewGroup} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Criar Grupo Financeiro</Text>
              <TouchableOpacity onPress={() => setModalNewGroup(false)}>
                <Ionicons name="close" size={24} color="#71717A" />
              </TouchableOpacity>
            </View>

            <Text style={styles.inputLabel}>NOME DO GRUPO</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Ex: Nossa Casa, Viagem Fim de Ano..."
              placeholderTextColor="#9CA3AF"
              value={newGroupName}
              onChangeText={setNewGroupName}
            />

            <Text style={styles.inputLabel}>TIPO DE COMPARTILHAMENTO</Text>
            <View style={styles.typePillsRow}>
              {['Casal', 'Família', 'Amigos', 'Moradia'].map((t) => (
                <TouchableOpacity
                  key={t}
                  style={[styles.typePill, newGroupType === t && styles.typePillActive]}
                  onPress={() => setNewGroupType(t)}
                >
                  <Text style={[styles.typePillText, newGroupType === t && styles.typePillTextActive]}>
                    {t}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.inputLabel}>DESCRIÇÃO (OPCIONAL)</Text>
            <TextInput
              style={[styles.modalInput, { height: 70 }]}
              placeholder="Ex: Despesas conjuntas do apartamento"
              placeholderTextColor="#9CA3AF"
              multiline
              value={newGroupDesc}
              onChangeText={setNewGroupDesc}
            />

            <TouchableOpacity style={styles.btnModalPrimary} onPress={handleCreateGroup}>
              <Text style={styles.btnModalPrimaryText}>Criar Grupo</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ============================================================== */}
      {/* MODAL 2: CONVIDAR PESSOA                                       */}
      {/* ============================================================== */}
      <Modal visible={modalInvite} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Convidar Pessoa</Text>
              <TouchableOpacity onPress={() => setModalInvite(false)}>
                <Ionicons name="close" size={24} color="#71717A" />
              </TouchableOpacity>
            </View>

            <Text style={styles.inputLabel}>E-MAIL DO CONVIDADO(A)</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="exemplo@email.com"
              placeholderTextColor="#9CA3AF"
              keyboardType="email-address"
              autoCapitalize="none"
              value={inviteEmail}
              onChangeText={setInviteEmail}
            />

            <Text style={styles.inputLabel}>RELAÇÃO / TIPO</Text>
            <View style={styles.typePillsRow}>
              {['Casal', 'Família', 'Amigos', 'Moradia'].map((t) => (
                <TouchableOpacity
                  key={t}
                  style={[styles.typePill, inviteType === t && styles.typePillActive]}
                  onPress={() => setInviteType(t)}
                >
                  <Text style={[styles.typePillText, inviteType === t && styles.typePillTextActive]}>
                    {t}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.inputLabel}>MENSAGEM (OPCIONAL)</Text>
            <TextInput
              style={[styles.modalInput, { height: 65 }]}
              placeholder="Vamos organizar nossas contas juntos pelo FINN!"
              placeholderTextColor="#9CA3AF"
              multiline
              value={inviteMessage}
              onChangeText={setInviteMessage}
            />

            <TouchableOpacity style={styles.btnModalPrimary} onPress={handleInvite}>
              <Text style={styles.btnModalPrimaryText}>Gerar Convite Seguro</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ============================================================== */}
      {/* MODAL 3: ENTRAR COM CÓDIGO                                     */}
      {/* ============================================================== */}
      <Modal visible={modalJoin} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Entrar com Código</Text>
              <TouchableOpacity onPress={() => setModalJoin(false)}>
                <Ionicons name="close" size={24} color="#71717A" />
              </TouchableOpacity>
            </View>

            <Text style={styles.inputLabel}>CÓDIGO DE 6 DÍGITOS</Text>
            <TextInput
              style={[styles.modalInput, { textAlign: 'center', fontSize: 22, fontWeight: '800', letterSpacing: 4 }]}
              placeholder="ABC123"
              placeholderTextColor="#9CA3AF"
              autoCapitalize="characters"
              maxLength={10}
              value={joinCode}
              onChangeText={setJoinCode}
            />

            <TouchableOpacity style={styles.btnModalPrimary} onPress={handleJoin}>
              <Text style={styles.btnModalPrimaryText}>Ingressar no Grupo</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ============================================================== */}
      {/* MODAL 4: LANÇAR DESPESA COMPARTILHADA COM DIVISÃO INTELIGENTE */}
      {/* ============================================================== */}
      <Modal visible={modalNewExpense} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Despesa Compartilhada</Text>
              <TouchableOpacity onPress={() => setModalNewExpense(false)}>
                <Ionicons name="close" size={24} color="#71717A" />
              </TouchableOpacity>
            </View>

            <Text style={styles.inputLabel}>DESCRIÇÃO</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Ex: Supermercado, Aluguel, Jantar..."
              placeholderTextColor="#9CA3AF"
              value={expDesc}
              onChangeText={setExpDesc}
            />

            <Text style={styles.inputLabel}>VALOR TOTAL (R$)</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="0,00"
              placeholderTextColor="#9CA3AF"
              keyboardType="numeric"
              value={expAmount}
              onChangeText={setExpAmount}
            />

            <Text style={styles.inputLabel}>QUEM PAGOU?</Text>
            <View style={styles.typePillsRow}>
              {groupMembers.map((m) => (
                <TouchableOpacity
                  key={m.id}
                  style={[styles.typePill, expPaidBy === m.name && styles.typePillActive]}
                  onPress={() => setExpPaidBy(m.name)}
                >
                  <Text style={[styles.typePillText, expPaidBy === m.name && styles.typePillTextActive]}>
                    {m.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.inputLabel}>DIVISÃO</Text>
            <View style={styles.typePillsRow}>
              <TouchableOpacity
                style={[styles.typePill, expSplitMethod === 'equal' && styles.typePillActive]}
                onPress={() => setExpSplitMethod('equal')}
              >
                <Text style={[styles.typePillText, expSplitMethod === 'equal' && styles.typePillTextActive]}>
                  Igual (50% / 50%)
                </Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity style={styles.btnModalPrimary} onPress={handleSaveSharedExpense}>
              <Text style={styles.btnModalPrimaryText}>Salvar e Dividir</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ============================================================== */}
      {/* MODAL 5: REGISTRAR ACERTO DE CONTAS                            */}
      {/* ============================================================== */}
      <Modal visible={modalSettlement} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Registrar Acerto</Text>
              <TouchableOpacity onPress={() => setModalSettlement(false)}>
                <Ionicons name="close" size={24} color="#71717A" />
              </TouchableOpacity>
            </View>

            <Text style={styles.inputLabel}>VALOR PAGO / ABATIDO (R$)</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="0,00"
              placeholderTextColor="#9CA3AF"
              keyboardType="numeric"
              value={settleAmount}
              onChangeText={setSettleAmount}
            />

            <Text style={styles.inputLabel}>OBSERVAÇÃO (OPCIONAL)</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Ex: Transferência PIX Nubank"
              placeholderTextColor="#9CA3AF"
              value={settleNotes}
              onChangeText={setSettleNotes}
            />

            <TouchableOpacity style={styles.btnModalPrimary} onPress={handleSaveSettlement}>
              <Text style={styles.btnModalPrimaryText}>Confirmar Pagamento</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F7F5FC',
  },
  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitleWrap: {
    flex: 1,
    marginLeft: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#18181B',
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#71717A',
    marginTop: 1,
  },
  inviteHeaderBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#EDE9FE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  firstAccessWrap: {
    padding: 20,
  },
  firstAccessHero: {
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    marginBottom: 20,
  },
  heroIconCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  firstAccessTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 8,
  },
  firstAccessSub: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.9)',
    textAlign: 'center',
    lineHeight: 19,
  },
  firstAccessCardsRow: {
    gap: 12,
    marginBottom: 24,
  },
  featureCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: '#EFEAF8',
  },
  featureTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#18181B',
    marginTop: 6,
    marginBottom: 4,
  },
  featureDesc: {
    fontSize: 12.5,
    color: '#71717A',
    lineHeight: 18,
  },
  firstAccessActions: {
    gap: 12,
  },
  primaryActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#7C3AED',
    paddingVertical: 14,
    borderRadius: 18,
    gap: 8,
  },
  primaryActionBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  secondaryActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#DDD6FE',
    paddingVertical: 14,
    borderRadius: 18,
    gap: 8,
  },
  secondaryActionBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#7C3AED',
  },
  tabsRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingBottom: 8,
    gap: 8,
  },
  tabBtn: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#EFEAF8',
  },
  tabBtnActive: {
    backgroundColor: '#7C3AED',
    borderColor: '#7C3AED',
  },
  tabBtnText: {
    fontSize: 12.5,
    fontWeight: '600',
    color: '#71717A',
  },
  tabBtnTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  contentScroll: {
    padding: 16,
  },
  summaryCard: {
    borderRadius: 22,
    padding: 20,
    marginBottom: 16,
  },
  summaryTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  summaryLabel: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.85)',
    fontWeight: '600',
  },
  badgeGroupType: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  badgeGroupTypeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  summaryValue: {
    fontSize: 30,
    fontWeight: '900',
    color: '#FFFFFF',
    marginVertical: 10,
  },
  splitsSummaryRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 6,
  },
  memberSharePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  memberShareText: {
    fontSize: 11.5,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  quickDebtsCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#EFEAF8',
    gap: 12,
  },
  quickDebtsIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#EDE9FE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickDebtsTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#18181B',
  },
  quickDebtsDesc: {
    fontSize: 12,
    color: '#71717A',
    marginTop: 2,
    lineHeight: 16,
  },
  btnPagarPill: {
    backgroundColor: '#7C3AED',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  btnPagarPillText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  btnNovaDespesa: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#7C3AED',
    paddingVertical: 14,
    borderRadius: 18,
    gap: 8,
    marginBottom: 22,
  },
  btnNovaDespesaText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#18181B',
    marginBottom: 12,
  },
  emptyBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#EFEAF8',
  },
  emptyTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#18181B',
    marginTop: 8,
  },
  emptySub: {
    fontSize: 12,
    color: '#71717A',
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 17,
  },
  txSharedCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#EFEAF8',
  },
  txSharedLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  txCategoryIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#EDE9FE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  txSharedDesc: {
    fontSize: 14,
    fontWeight: '700',
    color: '#18181B',
  },
  txSharedMeta: {
    fontSize: 11,
    color: '#71717A',
    marginTop: 2,
  },
  txSharedAmount: {
    fontSize: 15,
    fontWeight: '800',
    color: '#EF4444',
  },
  txSharedEach: {
    fontSize: 11,
    color: '#71717A',
    marginTop: 2,
  },
  acertoHeroBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    padding: 22,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#EFEAF8',
    marginBottom: 20,
  },
  acertoHeroLabel: {
    fontSize: 12.5,
    fontWeight: '600',
    color: '#71717A',
  },
  acertoHeroValue: {
    fontSize: 34,
    fontWeight: '900',
    color: '#7C3AED',
    marginVertical: 8,
  },
  acertoHeroSub: {
    fontSize: 13,
    color: '#18181B',
    fontWeight: '600',
    marginBottom: 16,
  },
  acertoPayBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#10B981',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 16,
  },
  acertoPayBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  settlementRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#EFEAF8',
  },
  settlementIconBox: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#D1FAE5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  settlementTitle: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#18181B',
  },
  settlementDate: {
    fontSize: 11,
    color: '#71717A',
    marginTop: 2,
  },
  settlementAmount: {
    fontSize: 15,
    fontWeight: '800',
    color: '#10B981',
  },
  groupInfoCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 18,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: '#EFEAF8',
  },
  groupInfoTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#18181B',
  },
  groupInfoSub: {
    fontSize: 12.5,
    color: '#71717A',
    marginTop: 2,
    marginBottom: 14,
  },
  btnConvidarNovo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#EDE9FE',
    paddingVertical: 10,
    borderRadius: 12,
  },
  btnConvidarNovoText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#7C3AED',
  },
  memberCardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#EFEAF8',
  },
  memberAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#7C3AED',
    alignItems: 'center',
    justifyContent: 'center',
  },
  memberAvatarText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  memberName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#18181B',
  },
  memberRole: {
    fontSize: 11.5,
    color: '#71717A',
    marginTop: 1,
  },
  memberBadgeActive: {
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  memberBadgeActiveText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#16A34A',
  },
  emptySimpleText: {
    fontSize: 12.5,
    color: '#71717A',
    fontStyle: 'italic',
  },
  invitationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#EFEAF8',
  },
  invEmail: {
    fontSize: 13,
    fontWeight: '700',
    color: '#18181B',
  },
  invMeta: {
    fontSize: 11,
    color: '#7C3AED',
    marginTop: 2,
    fontWeight: '600',
  },
  btnCopyLink: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#EDE9FE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    padding: 22,
    paddingBottom: 36,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#18181B',
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#71717A',
    marginBottom: 6,
    marginTop: 12,
  },
  modalInput: {
    backgroundColor: '#F7F5FC',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: '#18181B',
    borderWidth: 1,
    borderColor: '#EFEAF8',
  },
  typePillsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  typePill: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: '#F7F5FC',
    borderWidth: 1,
    borderColor: '#EFEAF8',
  },
  typePillActive: {
    backgroundColor: '#EDE9FE',
    borderColor: '#7C3AED',
  },
  typePillText: {
    fontSize: 12.5,
    fontWeight: '600',
    color: '#71717A',
  },
  typePillTextActive: {
    color: '#7C3AED',
    fontWeight: '700',
  },
  btnModalPrimary: {
    backgroundColor: '#7C3AED',
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 22,
  },
  btnModalPrimaryText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  headerActionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#EDE9FE',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#DDD6FE',
  },
  headerActionPillText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#7C3AED',
  },
  groupsSelectorWrap: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    paddingVertical: 10,
  },
  groupsSelectorScroll: {
    paddingHorizontal: 16,
    gap: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  groupChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 20,
  },
  groupChipActive: {
    backgroundColor: '#7C3AED',
    borderColor: '#6D28D9',
  },
  groupChipText: {
    fontSize: 12.5,
    fontWeight: '600',
    color: '#475569',
    maxWidth: 130,
  },
  groupChipTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  groupChipBadge: {
    backgroundColor: '#EDE9FE',
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  groupChipBadgeActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.28)',
  },
  groupChipBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#7C3AED',
  },
  groupChipBadgeTextActive: {
    color: '#FFFFFF',
  },
  addGroupChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F3E8FF',
    borderWidth: 1,
    borderColor: '#C084FC',
    borderStyle: 'dashed',
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 20,
  },
  addGroupChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#7C3AED',
  },
  btnExcluirGrupo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#FEE2E2',
    paddingVertical: 10,
    borderRadius: 12,
  },
  btnExcluirGrupoText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#EF4444',
  },
});

