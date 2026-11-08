import React, { useState, useMemo, useEffect } from 'react';
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
import * as Clipboard from 'expo-clipboard';
import { COLORS } from '../theme/colors';
import { useFinance, CATEGORIES } from '../context/FinanceContext';

export default function SharedFinancesScreen({ navigation, route }) {
  const insets = useSafeAreaInsets();
  const {
    loggedInUser,
    members,
    sharedGroups,
    activeGroupId,
    setActiveGroupId,
    createSharedGroup,
    generateNewGroupInviteCode,
    deleteSharedGroup,
    leaveSharedGroup,
    isGroupCreator,
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

  // Abas: 'dashboard' | 'divisao' | 'acertos' | 'membros'
  const [activeTab, setActiveTab] = useState(route?.params?.initialTab || 'dashboard');

  useEffect(() => {
    if (route?.params?.initialTab) {
      setActiveTab(route.params.initialTab);
    }
  }, [route?.params?.initialTab]);

  // Modais
  const [modalNewGroup, setModalNewGroup] = useState(false);
  const [modalInvite, setModalInvite] = useState(false);
  const [modalJoin, setModalJoin] = useState(false);
  const [modalNewExpense, setModalNewExpense] = useState(false);
  const [modalSettlement, setModalSettlement] = useState(false);

  // Formulário Novo Grupo
  const [newGroupTab, setNewGroupTab] = useState('create'); // 'create' | 'join'
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

  // ==============================================================
  // ESTADOS DA DIVISÃO DE CONTAS & ITENS (RACHADOR INTELIGENTE)
  // ==============================================================
  const [splitDesc, setSplitDesc] = useState('');
  const [splitTotal, setSplitTotal] = useState('');
  const [splitPaidBy, setSplitPaidBy] = useState(loggedInUser?.name || 'Você');
  const [splitSelectedMembers, setSplitSelectedMembers] = useState([]);
  const [splitShowItems, setSplitShowItems] = useState(false);
  const [splitItems, setSplitItems] = useState([]);
  const [newItemName, setNewItemName] = useState('');
  const [newItemAmount, setNewItemAmount] = useState('');
  const [newItemAssigned, setNewItemAssigned] = useState([]);
  const [serviceFeePercent, setServiceFeePercent] = useState(0); // 0, 10, 12, etc.

  const activeGroup = useMemo(() => {
    return sharedGroups.find((g) => g.id === activeGroupId) || sharedGroups[0] || null;
  }, [sharedGroups, activeGroupId]);

  const isOwner = useMemo(() => {
    return isGroupCreator ? isGroupCreator(activeGroup) : false;
  }, [activeGroup, isGroupCreator]);

  const groupMembers = useMemo(() => {
    if (activeGroup?.members && activeGroup.members.length > 0) {
      return activeGroup.members;
    }
    const currentName = loggedInUser?.name || loggedInUser?.fullName || 'Você';
    return [
      { id: loggedInUser?.id || 'm1', name: currentName, role: 'ADMIN' },
    ];
  }, [activeGroup, loggedInUser]);

  // Sincroniza participantes selecionados na ferramenta de Divisão de Contas
  useEffect(() => {
    if (groupMembers && groupMembers.length > 0) {
      setSplitSelectedMembers((prev) => {
        if (!prev || prev.length === 0) {
          return groupMembers.map((m) => m.id || m.name);
        }
        const validIds = groupMembers.map((m) => m.id || m.name);
        const filtered = prev.filter((id) => validIds.includes(id));
        return filtered.length > 0 ? filtered : validIds;
      });

      const currentUserName = loggedInUser?.name || loggedInUser?.fullName || 'Você';
      if (!splitPaidBy || splitPaidBy === 'Você') {
        const found = groupMembers.find((m) => m.name === currentUserName);
        setSplitPaidBy(found ? found.name : groupMembers[0].name);
      }
    }
  }, [groupMembers, loggedInUser]);

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

  // ==============================================================
  // CÁLCULO REATIVO DA DIVISÃO DE CONTAS (IGUALITÁRIA OU POR ITENS)
  // ==============================================================
  const billSplitCalculation = useMemo(() => {
    const rawTotal = parseFloat(String(splitTotal).replace(',', '.')) || 0;
    const tipAmount = (rawTotal * (serviceFeePercent || 0)) / 100;
    const effectiveTotal = rawTotal + tipAmount;

    const activeMembers = groupMembers.filter((m) =>
      splitSelectedMembers.includes(m.id || m.name)
    );
    const memberCount = activeMembers.length;

    if (memberCount === 0 || effectiveTotal <= 0) {
      return {
        rawTotal,
        tipAmount,
        effectiveTotal,
        activeMembers,
        itemsTotal: 0,
        commonAmount: 0,
        commonPerMember: 0,
        memberResults: activeMembers.map((m) => ({
          id: m.id || m.name,
          name: m.name,
          itemsShare: 0,
          commonShare: 0,
          tipShare: 0,
          totalToPay: 0,
          consumedItems: [],
          isPayer: (splitPaidBy || groupMembers[0]?.name) === m.name,
        })),
        hasItems: false,
        itemsExceedTotal: false,
      };
    }

    // 1. Itens individuais cadastrados
    let itemsTotal = 0;
    const memberItemMap = {};
    activeMembers.forEach((m) => {
      memberItemMap[m.id || m.name] = { total: 0, items: [] };
    });

    splitItems.forEach((item) => {
      const itemAmt = parseFloat(item.amount) || 0;
      itemsTotal += itemAmt;
      const assignedIds = (item.assignedTo || []).filter((id) =>
        activeMembers.some((m) => (m.id || m.name) === id)
      );
      // Se nenhum participante foi atribuído explicitamente ao item, rateia entre todos os participantes da conta
      const targetIds = assignedIds.length > 0 ? assignedIds : activeMembers.map((m) => m.id || m.name);
      const perPerson = itemAmt / targetIds.length;

      targetIds.forEach((id) => {
        if (memberItemMap[id]) {
          memberItemMap[id].total += perPerson;
          memberItemMap[id].items.push({
            name: item.name,
            amount: perPerson,
          });
        }
      });
    });

    const hasItems = splitItems.length > 0;
    const itemsExceedTotal = itemsTotal > rawTotal;

    // 2. Diferença restante da conta (despesa comum a ser dividida entre todos os selecionados)
    const commonDifference = Math.max(0, rawTotal - itemsTotal);
    const commonPerMember = commonDifference / memberCount;
    const tipPerMember = tipAmount / memberCount;

    // 3. Monta o resumo detalhado por membro
    const memberResults = activeMembers.map((m) => {
      const key = m.id || m.name;
      const itemsShare = memberItemMap[key]?.total || 0;
      const myItemsList = memberItemMap[key]?.items || [];
      const totalToPay = itemsShare + commonPerMember + tipPerMember;

      return {
        id: key,
        name: m.name,
        itemsShare: Math.round(itemsShare * 100) / 100,
        commonShare: Math.round(commonPerMember * 100) / 100,
        tipShare: Math.round(tipPerMember * 100) / 100,
        totalToPay: Math.round(totalToPay * 100) / 100,
        consumedItems: myItemsList,
        isPayer: (splitPaidBy || groupMembers[0]?.name) === m.name,
      };
    });

    // 4. Ajuste fino de arredondamento de centavos
    const calculatedSum = memberResults.reduce((acc, r) => acc + r.totalToPay, 0);
    const diffCentavos = Math.round((effectiveTotal - calculatedSum) * 100) / 100;
    if (Math.abs(diffCentavos) > 0 && memberResults.length > 0) {
      memberResults[0].totalToPay = Math.round((memberResults[0].totalToPay + diffCentavos) * 100) / 100;
    }

    return {
      rawTotal,
      tipAmount,
      effectiveTotal,
      activeMembers,
      itemsTotal,
      commonAmount: commonDifference,
      commonPerMember,
      memberResults,
      hasItems,
      itemsExceedTotal,
    };
  }, [splitTotal, serviceFeePercent, groupMembers, splitSelectedMembers, splitItems, splitPaidBy]);

  // ==============================================================
  // CÁLCULO DE ACERTO DE CONTAS (QUEM DEVE PARA QUEM COM SPLITS)
  // ==============================================================
  const debtsCalculation = useMemo(() => {
    const balances = {};
    groupMembers.forEach((m) => {
      balances[m.name] = 0;
    });

    sharedTxs.forEach((tx) => {
      const payer = tx.paidBy || groupMembers[0]?.name || 'Você';
      const totalAmt = tx.amount || 0;
      if (balances[payer] === undefined) balances[payer] = 0;

      if (tx.splitDetails?.members && Array.isArray(tx.splitDetails.members)) {
        balances[payer] += totalAmt;
        tx.splitDetails.members.forEach((sm) => {
          if (balances[sm.name] === undefined) balances[sm.name] = 0;
          balances[sm.name] -= (sm.totalToPay || 0);
        });
      } else {
        const count = groupMembers.length || 1;
        const share = totalAmt / count;
        balances[payer] += totalAmt;
        groupMembers.forEach((m) => {
          balances[m.name] = (balances[m.name] || 0) - share;
        });
      }
    });

    // Subtrai acertos já realizados e confirmados
    settlements.forEach((s) => {
      if (balances[s.fromMember] !== undefined) balances[s.fromMember] += (s.amount || 0);
      if (balances[s.toMember] !== undefined) balances[s.toMember] -= (s.amount || 0);
    });

    const member1 = groupMembers[0]?.name || (loggedInUser?.name || 'Você');
    const member2 = groupMembers[1]?.name || 'Participante';
    const netOwed = Math.round(((balances[member1] || 0) - (balances[member2] || 0)) / 2 * 100) / 100;

    // Resumo de débitos par a par para qualquer número de membros
    const creditors = [];
    const debtors = [];
    Object.entries(balances).forEach(([name, bal]) => {
      const rounded = Math.round(bal * 100) / 100;
      if (rounded > 0.01) creditors.push({ name, amount: rounded });
      else if (rounded < -0.01) debtors.push({ name, amount: Math.abs(rounded) });
    });

    const pairwiseDebts = [];
    let cIdx = 0;
    let dIdx = 0;
    const credCopy = creditors.map((c) => ({ ...c }));
    const debtCopy = debtors.map((d) => ({ ...d }));

    while (cIdx < credCopy.length && dIdx < debtCopy.length) {
      const settleAmt = Math.min(credCopy[cIdx].amount, debtCopy[dIdx].amount);
      if (settleAmt > 0.01) {
        pairwiseDebts.push({
          from: debtCopy[dIdx].name,
          to: credCopy[cIdx].name,
          amount: Math.round(settleAmt * 100) / 100,
        });
      }
      credCopy[cIdx].amount -= settleAmt;
      debtCopy[dIdx].amount -= settleAmt;
      if (credCopy[cIdx].amount < 0.01) cIdx++;
      if (debtCopy[dIdx].amount < 0.01) dIdx++;
    }

    return {
      member1,
      member2,
      netOwed,
      balances,
      pairwiseDebts,
    };
  }, [sharedTxs, settlements, groupMembers, loggedInUser]);

  // ==============================================================
  // AÇÕES DA DIVISÃO DE CONTAS (ADICIONAR ITEM, SALVAR, COMPARTILHAR)
  // ==============================================================
  const handleAddSplitItem = () => {
    const amt = parseFloat(String(newItemAmount).replace(',', '.')) || 0;
    if (!newItemName.trim()) {
      Alert.alert('Item sem descrição', 'Informe o nome do item consumido.');
      return;
    }
    if (amt <= 0) {
      Alert.alert('Valor inválido', 'Informe um valor maior que zero para o item.');
      return;
    }

    const assigned = newItemAssigned.length > 0
      ? newItemAssigned
      : splitSelectedMembers;

    const newItem = {
      id: 'item-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4),
      name: newItemName.trim(),
      amount: amt,
      assignedTo: assigned,
    };

    setSplitItems((prev) => [...prev, newItem]);
    setNewItemName('');
    setNewItemAmount('');
    setNewItemAssigned([]);
  };

  const handleRemoveSplitItem = (itemId) => {
    setSplitItems((prev) => prev.filter((it) => it.id !== itemId));
  };

  const toggleMemberSelection = (memberId) => {
    setSplitSelectedMembers((prev) => {
      if (prev.includes(memberId)) {
        if (prev.length <= 1) {
          Alert.alert('Atenção', 'Pelo menos um participante deve fazer parte da divisão.');
          return prev;
        }
        return prev.filter((id) => id !== memberId);
      } else {
        return [...prev, memberId];
      }
    });
  };

  const toggleNewItemMember = (memberId) => {
    setNewItemAssigned((prev) => {
      if (prev.includes(memberId)) {
        return prev.filter((id) => id !== memberId);
      } else {
        return [...prev, memberId];
      }
    });
  };

  const handleSyncTotalWithItems = () => {
    const sum = splitItems.reduce((acc, it) => acc + (it.amount || 0), 0);
    setSplitTotal(sum.toFixed(2));
  };

  const formatSplitShareMessage = () => {
    let msg = `🧾 *DIVISÃO DE CONTA — ${activeGroup?.name || 'FINN'}*\n`;
    if (splitDesc.trim()) msg += `📝 *${splitDesc.trim()}*\n`;
    msg += `💰 *Total da Conta:* ${formatMoney(billSplitCalculation.effectiveTotal)}\n`;
    msg += `👤 *Pago por:* ${splitPaidBy || groupMembers[0]?.name}\n`;
    msg += `👥 *Participantes:* ${billSplitCalculation.activeMembers.length} pessoas\n\n`;

    if (billSplitCalculation.hasItems) {
      msg += `🍽️ *Consumo e Itens Discriminados:*\n`;
      splitItems.forEach((it) => {
        const assignedNames = (it.assignedTo || [])
          .map((id) => groupMembers.find((m) => (m.id || m.name) === id)?.name || id)
          .join(', ');
        msg += `  • ${it.name}: ${formatMoney(it.amount)} (${assignedNames || 'Todos'})\n`;
      });
      if (billSplitCalculation.commonAmount > 0) {
        msg += `  • Restante comum compartilhado: ${formatMoney(billSplitCalculation.commonAmount)} (${formatMoney(billSplitCalculation.commonPerMember)}/pessoa)\n`;
      }
      msg += `\n`;
    }

    msg += `💵 *VALOR FINAL POR PESSOA:*\n`;
    billSplitCalculation.memberResults.forEach((r) => {
      const payerTag = r.isPayer ? ' 💳 (Pagou)' : '';
      let detail = '';
      if (billSplitCalculation.hasItems && r.itemsShare > 0) {
        detail = ` [Itens: ${formatMoney(r.itemsShare)} + Comum: ${formatMoney(r.commonShare)}]`;
      }
      msg += `• *${r.name}*${payerTag}: ${formatMoney(r.totalToPay)}${detail}\n`;
    });

    msg += `\n✨ Calculado pelo app FINN`;
    return msg;
  };

  const handleShareBillSplit = async () => {
    if (billSplitCalculation.effectiveTotal <= 0) {
      Alert.alert('Atenção', 'Informe o valor da conta antes de compartilhar.');
      return;
    }
    const msg = formatSplitShareMessage();
    try {
      await Share.share({ message: msg });
    } catch (e) {
      console.warn('Erro ao compartilhar:', e);
    }
  };

  const handleSaveBillSplit = async () => {
    if (billSplitCalculation.effectiveTotal <= 0) {
      Alert.alert('Valor Inválido', 'Informe o valor total da conta para registrar.');
      return;
    }
    if (billSplitCalculation.activeMembers.length === 0) {
      Alert.alert('Participantes', 'Selecione pelo menos um participante do grupo.');
      return;
    }

    try {
      const payerName = splitPaidBy || groupMembers[0]?.name || 'Você';
      const desc = splitDesc.trim() || 'Conta Dividida';

      await addSharedExpense({
        description: desc,
        amount: billSplitCalculation.effectiveTotal,
        paidBy: payerName,
        category: 'alimentacao',
        groupId: activeGroup.id,
        splitMethod: splitItems.length > 0 ? 'by_items' : 'equal',
        splitDetails: {
          items: splitItems,
          members: billSplitCalculation.memberResults,
          commonAmount: billSplitCalculation.commonAmount,
          tipAmount: billSplitCalculation.tipAmount,
          totalBill: billSplitCalculation.effectiveTotal,
        },
      });

      Alert.alert(
        'Conta Dividida e Registrada! 🎉',
        `A conta "${desc}" de ${formatMoney(billSplitCalculation.effectiveTotal)} foi lançada no grupo '${activeGroup?.name}'.\n\nOs valores devidos foram integrados ao Balanço de Acertos.`,
        [
          {
            text: 'Ver no Painel',
            onPress: () => setActiveTab('dashboard'),
          },
          {
            text: 'Compartilhar Resumo',
            onPress: handleShareBillSplit,
          },
        ]
      );
    } catch (e) {
      Alert.alert('Erro ao salvar', e.message);
    }
  };

  const handleResetBillSplit = () => {
    setSplitDesc('');
    setSplitTotal('');
    setSplitItems([]);
    setSplitShowItems(false);
    setServiceFeePercent(0);
    setNewItemName('');
    setNewItemAmount('');
    setNewItemAssigned([]);
    if (groupMembers && groupMembers.length > 0) {
      setSplitSelectedMembers(groupMembers.map((m) => m.id || m.name));
    }
  };

  // Status de validade do código de convite de 30 minutos
  const inviteCodeStatus = useMemo(() => {
    if (!activeGroup?.inviteCode) {
      return { hasCode: false, isExpired: true, minutesLeft: 0, text: 'Sem código gerado' };
    }
    if (!activeGroup.inviteCodeExpiresAt) {
      return { hasCode: true, isExpired: false, minutesLeft: 30, text: 'Válido por 30 min' };
    }
    const diffMs = new Date(activeGroup.inviteCodeExpiresAt).getTime() - Date.now();
    const minutesLeft = Math.max(0, Math.ceil(diffMs / (60 * 1000)));
    if (minutesLeft <= 0) {
      return { hasCode: true, isExpired: true, minutesLeft: 0, text: 'Código expirado' };
    }
    return {
      hasCode: true,
      isExpired: false,
      minutesLeft,
      text: `Válido por mais ${minutesLeft} min`,
    };
  }, [activeGroup?.inviteCode, activeGroup?.inviteCodeExpiresAt]);

  const formatMoney = (val) => {
    return (
      'R$ ' +
      (val || 0).toLocaleString('pt-BR', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })
    );
  };

  // 1. Criar Grupo (Gera código único válido por 30 minutos)
  const handleCreateGroup = async () => {
    if (!newGroupName.trim()) {
      Alert.alert('Atenção', 'Informe o nome do grupo.');
      return;
    }
    try {
      const created = await createSharedGroup({
        name: newGroupName.trim(),
        type: newGroupType,
        description: newGroupDesc.trim(),
      });
      setModalNewGroup(false);
      setNewGroupName('');
      setNewGroupDesc('');

      Alert.alert(
        'Grupo Criado com Sucesso! 🎉',
        `Nome: ${created.name}\nCódigo de Convite: ${created.inviteCode}\n\nEste código é único e válido por 30 minutos para você enviar aos outros participantes.`,
        [
          { text: 'Concluir' },
          {
            text: 'Compartilhar Código',
            onPress: () => {
              Share.share({
                message: `Olá! Estou te convidando para o grupo '${created.name}' no FINN. Baixe o app e entre com o código de convite: ${created.inviteCode} (válido por 30 minutos).`,
              });
            },
          },
        ]
      );
    } catch (e) {
      Alert.alert('Erro', e.message);
    }
  };

  // Gerar Novo Código de Convite (Válido por 30 min)
  const handleRegenerateInviteCode = async () => {
    if (!activeGroup?.id) return;
    try {
      const res = await generateNewGroupInviteCode(activeGroup.id);
      if (res?.inviteCode) {
        Alert.alert(
          'Novo Código Gerado! 🔄',
          `Novo Código: ${res.inviteCode}\n\nEste código é único e está válido pelos próximos 30 minutos.`,
          [
            { text: 'OK' },
            {
              text: 'Compartilhar',
              onPress: () => {
                Share.share({
                  message: `Olá! Aqui está o novo código de convite para o grupo '${activeGroup.name}' no FINN: ${res.inviteCode} (válido por 30 minutos).`,
                });
              },
            },
          ]
        );
      }
    } catch (e) {
      Alert.alert('Erro ao gerar código', e.message);
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
      const joined = await acceptGroupInvitation(joinCode.trim());
      if (joined?.id && setActiveGroupId) {
        setActiveGroupId(joined.id);
      }
      setModalJoin(false);
      setModalNewGroup(false);
      setJoinCode('');
      Alert.alert(
        'Sucesso! 🎉',
        `Você ingressou no grupo '${joined?.name || 'Compartilhado'}' com sucesso!`
      );
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

  // Excluir Grupo (Apenas o Criador/Dono)
  const handleDeleteGroup = (groupId) => {
    if (!isOwner) {
      Alert.alert('Atenção', 'Apenas quem criou o grupo tem permissão para excluí-lo.');
      return;
    }
    Alert.alert(
      'Excluir Grupo',
      `Tem certeza que deseja excluir o grupo "${activeGroup?.name}"?\n\nEsta ação é irreversível. O grupo será excluído e todos os participantes perderão o acesso.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Excluir Grupo',
          style: 'destructive',
          onPress: async () => {
            try {
              if (deleteSharedGroup) {
                await deleteSharedGroup(groupId);
                Alert.alert('Sucesso', `Grupo "${activeGroup?.name}" excluído com sucesso.`);
              }
            } catch (e) {
              Alert.alert('Erro ao excluir', e.message);
            }
          },
        },
      ]
    );
  };

  // Sair do Grupo (Membros saem e o criador é notificado)
  const handleLeaveGroup = (groupId) => {
    Alert.alert(
      'Sair do Grupo',
      `Tem certeza que deseja sair do grupo "${activeGroup?.name}"?\n\nO criador do grupo será notificado sobre a sua saída.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Sair do Grupo',
          style: 'destructive',
          onPress: async () => {
            try {
              if (leaveSharedGroup) {
                const res = await leaveSharedGroup(groupId);
                Alert.alert('Sucesso', res?.message || 'Você saiu do grupo com sucesso. O criador foi notificado.');
              }
            } catch (e) {
              Alert.alert('Erro ao sair do grupo', e.message);
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
          {/* ABAS DO MÓDULO: DASHBOARD | DIVIDIR CONTA | ACERTO DE CONTAS | MEMBROS */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.tabsRow}
          >
            <TouchableOpacity
              style={[styles.tabBtn, activeTab === 'dashboard' && styles.tabBtnActive]}
              onPress={() => setActiveTab('dashboard')}
            >
              <Text style={[styles.tabBtnText, activeTab === 'dashboard' && styles.tabBtnTextActive]}>
                Painel
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.tabBtn, activeTab === 'divisao' && styles.tabBtnActive]}
              onPress={() => setActiveTab('divisao')}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Ionicons
                  name="pie-chart"
                  size={13}
                  color={activeTab === 'divisao' ? '#7C3AED' : '#64748B'}
                />
                <Text style={[styles.tabBtnText, activeTab === 'divisao' && styles.tabBtnTextActive]}>
                  Dividir Conta
                </Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.tabBtn, activeTab === 'acertos' && styles.tabBtnActive]}
              onPress={() => setActiveTab('acertos')}
            >
              <Text style={[styles.tabBtnText, activeTab === 'acertos' && styles.tabBtnTextActive]}>
                Acertos
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.tabBtn, activeTab === 'membros' && styles.tabBtnActive]}
              onPress={() => setActiveTab('membros')}
            >
              <Text style={[styles.tabBtnText, activeTab === 'membros' && styles.tabBtnTextActive]}>
                Membros ({groupMembers.length})
              </Text>
            </TouchableOpacity>
          </ScrollView>

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

                {/* BANNER DIVIDIR CONTA OU DESPESA COM ITENS */}
                <TouchableOpacity
                  style={styles.billSplitBanner}
                  onPress={() => setActiveTab('divisao')}
                  activeOpacity={0.88}
                >
                  <LinearGradient
                    colors={['#7C3AED', '#6D28D9']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.billSplitBannerGradient}
                  >
                    <View style={styles.billSplitBannerIcon}>
                      <Ionicons name="pie-chart" size={22} color="#FFFFFF" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.billSplitBannerTitle}>Dividir Conta do Grupo</Text>
                      <Text style={styles.billSplitBannerSub}>
                        Rache valores igualmente ou selecione o consumo individual de cada membro
                      </Text>
                    </View>
                    <Ionicons name="arrow-forward-circle" size={24} color="#FFFFFF" />
                  </LinearGradient>
                </TouchableOpacity>

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
            {/* ABA 2: DIVISÃO DE CONTAS / RACHADOR INTELIGENTE COM ITENS       */}
            {/* ============================================================== */}
            {activeTab === 'divisao' && (
              <>
                {/* 1. Header explicativo */}
                <View style={styles.splitHeaderCard}>
                  <View style={styles.splitHeaderIconBox}>
                    <Ionicons name="pie-chart" size={22} color="#7C3AED" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.splitHeaderTitle}>Divisão de Conta</Text>
                    <Text style={styles.splitHeaderSub}>
                      {activeGroup?.name} • Rache o valor igualmente ou selecione itens
                    </Text>
                  </View>
                  {billSplitCalculation.effectiveTotal > 0 && (
                    <TouchableOpacity
                      style={styles.splitResetSmallBtn}
                      onPress={handleResetBillSplit}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="refresh" size={13} color="#6B7280" />
                      <Text style={styles.splitResetSmallBtnText}>Limpar</Text>
                    </TouchableOpacity>
                  )}
                </View>

                {/* 2. Formulário Principal da Conta */}
                <View style={styles.splitFormCard}>
                  <Text style={styles.splitFieldLabel}>DESCRIÇÃO DA CONTA</Text>
                  <TextInput
                    style={styles.splitInputDesc}
                    placeholder="Ex: Restaurante Outback, Pizzaria, Mercado..."
                    placeholderTextColor="#94A3B8"
                    value={splitDesc}
                    onChangeText={setSplitDesc}
                  />

                  <Text style={[styles.splitFieldLabel, { marginTop: 14 }]}>VALOR TOTAL DA CONTA</Text>
                  <View style={styles.splitInputTotalRow}>
                    <Text style={styles.splitInputCurrency}>R$</Text>
                    <TextInput
                      style={styles.splitInputTotal}
                      placeholder="0,00"
                      placeholderTextColor="#CBD5E1"
                      keyboardType="numeric"
                      value={splitTotal}
                      onChangeText={setSplitTotal}
                    />
                  </View>

                  {/* Taxa de serviço / Gorjeta */}
                  <View style={styles.splitTipRow}>
                    <Text style={styles.splitTipLabel}>Taxa / Gorjeta (Opcional):</Text>
                    <View style={styles.splitTipChips}>
                      {[0, 10, 12, 15].map((pct) => (
                        <TouchableOpacity
                          key={pct}
                          style={[styles.splitTipChip, serviceFeePercent === pct && styles.splitTipChipActive]}
                          onPress={() => setServiceFeePercent(pct)}
                        >
                          <Text
                            style={[
                              styles.splitTipChipText,
                              serviceFeePercent === pct && styles.splitTipChipTextActive,
                            ]}
                          >
                            {pct === 0 ? 'Sem taxa' : `+${pct}%`}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                  {billSplitCalculation.tipAmount > 0 && (
                    <Text style={styles.splitTipInfo}>
                      Taxa de {serviceFeePercent}%: +{formatMoney(billSplitCalculation.tipAmount)} (Total com taxa: {formatMoney(billSplitCalculation.effectiveTotal)})
                    </Text>
                  )}

                  {/* Quem pagou a conta */}
                  <Text style={[styles.splitFieldLabel, { marginTop: 14 }]}>QUEM PAGOU A CONTA?</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 6 }}>
                    <View style={{ flexDirection: 'row', gap: 8 }}>
                      {groupMembers.map((m) => {
                        const isPayer = (splitPaidBy || groupMembers[0]?.name) === m.name;
                        return (
                          <TouchableOpacity
                            key={m.id || m.name}
                            style={[styles.splitPayerChip, isPayer && styles.splitPayerChipActive]}
                            onPress={() => setSplitPaidBy(m.name)}
                            activeOpacity={0.8}
                          >
                            <View style={[styles.splitPayerAvatar, isPayer && styles.splitPayerAvatarActive]}>
                              <Text style={[styles.splitPayerAvatarText, isPayer && styles.splitPayerAvatarTextActive]}>
                                {m.name.charAt(0).toUpperCase()}
                              </Text>
                            </View>
                            <Text style={[styles.splitPayerText, isPayer && styles.splitPayerTextActive]}>
                              {m.name}
                            </Text>
                            {isPayer && <Ionicons name="checkmark-circle" size={14} color="#7C3AED" />}
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </ScrollView>
                </View>

                {/* 3. Seleção de Participantes */}
                <View style={styles.splitMembersCard}>
                  <View style={styles.splitSectionTitleRow}>
                    <View>
                      <Text style={styles.splitSectionTitle}>Quem vai dividir essa conta?</Text>
                      <Text style={styles.splitSectionSub}>
                        {billSplitCalculation.activeMembers.length} de {groupMembers.length} participantes selecionados
                      </Text>
                    </View>
                    <View style={{ flexDirection: 'row', gap: 6 }}>
                      <TouchableOpacity
                        style={styles.splitMiniActionBtn}
                        onPress={() => setSplitSelectedMembers(groupMembers.map((m) => m.id || m.name))}
                      >
                        <Text style={styles.splitMiniActionText}>Todos</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.splitMiniActionBtn}
                        onPress={() => {
                          if (groupMembers.length > 0) {
                            setSplitSelectedMembers([groupMembers[0].id || groupMembers[0].name]);
                          }
                        }}
                      >
                        <Text style={styles.splitMiniActionText}>Limpar</Text>
                      </TouchableOpacity>
                    </View>
                  </View>

                  <View style={styles.splitMembersList}>
                    {groupMembers.map((m) => {
                      const isSelected = splitSelectedMembers.includes(m.id || m.name);
                      const isPayer = (splitPaidBy || groupMembers[0]?.name) === m.name;
                      return (
                        <TouchableOpacity
                          key={m.id || m.name}
                          style={[styles.splitMemberToggleRow, isSelected && styles.splitMemberToggleRowActive]}
                          onPress={() => toggleMemberSelection(m.id || m.name)}
                          activeOpacity={0.8}
                        >
                          <View style={[styles.splitMemberAvatar, isSelected && styles.splitMemberAvatarActive]}>
                            <Text style={[styles.splitMemberAvatarText, isSelected && styles.splitMemberAvatarTextActive]}>
                              {m.name.charAt(0).toUpperCase()}
                            </Text>
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={[styles.splitMemberName, isSelected && styles.splitMemberNameActive]}>
                              {m.name}
                            </Text>
                            <Text style={styles.splitMemberRole}>
                              {isPayer ? '💳 Pagou a conta' : 'Participante do grupo'}
                            </Text>
                          </View>
                          <Ionicons
                            name={isSelected ? 'checkbox' : 'square-outline'}
                            size={22}
                            color={isSelected ? '#7C3AED' : '#94A3B8'}
                          />
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>

                {/* 4. Seção Expansível de Itens Consumidos (Opcional) */}
                <View style={styles.splitItemsContainer}>
                  <TouchableOpacity
                    style={styles.splitItemsToggleCard}
                    onPress={() => setSplitShowItems(!splitShowItems)}
                    activeOpacity={0.85}
                  >
                    <View style={styles.splitItemsToggleIcon}>
                      <Ionicons name="fast-food-outline" size={20} color="#7C3AED" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.splitItemsToggleTitle}>
                        Itens e Consumo Individual (Opcional)
                      </Text>
                      <Text style={styles.splitItemsToggleSub}>
                        {splitItems.length === 0
                          ? 'Toque para discriminar o que membros específicos consumiram'
                          : `${splitItems.length} ${splitItems.length === 1 ? 'item cadastrado' : 'itens cadastrados'} (${formatMoney(billSplitCalculation.itemsTotal)})`}
                      </Text>
                    </View>
                    <Ionicons
                      name={splitShowItems ? 'chevron-up' : 'chevron-down'}
                      size={20}
                      color="#7C3AED"
                    />
                  </TouchableOpacity>

                  {splitShowItems && (
                    <View style={styles.splitItemsBox}>
                      <Text style={styles.splitItemsBoxHint}>
                        💡 Adicione itens consumidos exclusivamente por certos participantes. A diferença restante da conta ({formatMoney(billSplitCalculation.commonAmount)}) será dividida igualmente entre os participantes selecionados.
                      </Text>

                      {/* Formulário Novo Item */}
                      <View style={styles.newItemCard}>
                        <Text style={styles.newItemLabel}>NOVO ITEM CONSUMIDO</Text>
                        <View style={styles.newItemInputRow}>
                          <TextInput
                            style={[styles.modalInput, { flex: 2, marginBottom: 0 }]}
                            placeholder="Ex: Hambúrguer, Vinho..."
                            placeholderTextColor="#94A3B8"
                            value={newItemName}
                            onChangeText={setNewItemName}
                          />
                          <TextInput
                            style={[styles.modalInput, { flex: 1, marginBottom: 0 }]}
                            placeholder="R$ 0,00"
                            placeholderTextColor="#94A3B8"
                            keyboardType="numeric"
                            value={newItemAmount}
                            onChangeText={setNewItemAmount}
                          />
                        </View>

                        <Text style={[styles.newItemLabel, { marginTop: 10 }]}>QUEM CONSUMIU ESTE ITEM?</Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 4 }}>
                          <View style={{ flexDirection: 'row', gap: 6 }}>
                            {billSplitCalculation.activeMembers.map((m) => {
                              const isAssigned = newItemAssigned.includes(m.id || m.name);
                              return (
                                <TouchableOpacity
                                  key={m.id || m.name}
                                  style={[styles.itemMemberChip, isAssigned && styles.itemMemberChipActive]}
                                  onPress={() => toggleNewItemMember(m.id || m.name)}
                                >
                                  <Text style={[styles.itemMemberChipText, isAssigned && styles.itemMemberChipTextActive]}>
                                    {m.name}
                                  </Text>
                                  {isAssigned && <Ionicons name="checkmark" size={12} color="#FFFFFF" />}
                                </TouchableOpacity>
                              );
                            })}
                          </View>
                        </ScrollView>
                        <Text style={styles.itemAssignHelp}>
                          {newItemAssigned.length === 0
                            ? 'Se não selecionar ninguém, o item é rateado entre todos os membros da conta.'
                            : `${newItemAssigned.length} ${newItemAssigned.length === 1 ? 'pessoa dividirá' : 'pessoas dividirão'} o item.`}
                        </Text>

                        <TouchableOpacity
                          style={styles.btnAddItemBtn}
                          onPress={handleAddSplitItem}
                          activeOpacity={0.8}
                        >
                          <Ionicons name="add" size={18} color="#FFFFFF" />
                          <Text style={styles.btnAddItemBtnText}>Adicionar Item</Text>
                        </TouchableOpacity>
                      </View>

                      {/* Lista de Itens Já Adicionados */}
                      {splitItems.length > 0 && (
                        <View style={{ marginTop: 12 }}>
                          <Text style={styles.itemsListTitle}>Itens Cadastrados ({splitItems.length})</Text>
                          {splitItems.map((item) => {
                            const assignedNames = (item.assignedTo || [])
                              .map((id) => groupMembers.find((m) => (m.id || m.name) === id)?.name || id)
                              .join(', ');
                            return (
                              <View key={item.id} style={styles.splitItemRow}>
                                <View style={{ flex: 1 }}>
                                  <Text style={styles.splitItemRowName}>{item.name}</Text>
                                  <Text style={styles.splitItemRowAssigned}>
                                    Consumido por: {assignedNames || 'Todos os selecionados'}
                                  </Text>
                                </View>
                                <Text style={styles.splitItemRowAmount}>{formatMoney(item.amount)}</Text>
                                <TouchableOpacity
                                  onPress={() => handleRemoveSplitItem(item.id)}
                                  style={styles.splitItemRemoveBtn}
                                >
                                  <Ionicons name="trash-outline" size={16} color="#EF4444" />
                                </TouchableOpacity>
                              </View>
                            );
                          })}

                          {/* Banner da Diferença Restante */}
                          <View style={styles.diffBanner}>
                            <View style={{ flex: 1 }}>
                              <Text style={styles.diffBannerTitle}>Diferença Restante (Comum)</Text>
                              <Text style={styles.diffBannerSub}>
                                {formatMoney(billSplitCalculation.commonAmount)} ÷ {billSplitCalculation.activeMembers.length} pessoas = {formatMoney(billSplitCalculation.commonPerMember)}/cada
                              </Text>
                            </View>
                            <View style={styles.diffBadge}>
                              <Text style={styles.diffBadgeText}>{formatMoney(billSplitCalculation.commonAmount)}</Text>
                            </View>
                          </View>

                          {billSplitCalculation.itemsExceedTotal && (
                            <View style={styles.exceedBanner}>
                              <Ionicons name="warning-outline" size={18} color="#B45309" />
                              <View style={{ flex: 1 }}>
                                <Text style={styles.exceedTitle}>Itens superam o total da conta</Text>
                                <Text style={styles.exceedSub}>
                                  A soma dos itens ({formatMoney(billSplitCalculation.itemsTotal)}) é maior que o valor total ({formatMoney(billSplitCalculation.rawTotal)}).
                                </Text>
                                <TouchableOpacity
                                  style={styles.btnAjustarTotal}
                                  onPress={handleSyncTotalWithItems}
                                >
                                  <Text style={styles.btnAjustarTotalText}>
                                    Ajustar Total para {formatMoney(billSplitCalculation.itemsTotal)}
                                  </Text>
                                </TouchableOpacity>
                              </View>
                            </View>
                          )}
                        </View>
                      )}
                    </View>
                  )}
                </View>

                {/* 5. Card Resumo Final da Divisão */}
                <View style={styles.splitSummaryCard}>
                  <View style={styles.splitSummaryHeader}>
                    <View>
                      <Text style={styles.splitSummaryTitle}>Resultado da Divisão</Text>
                      <Text style={styles.splitSummarySub}>
                        Total: {formatMoney(billSplitCalculation.effectiveTotal)} • {billSplitCalculation.activeMembers.length} participantes
                      </Text>
                    </View>
                    <View style={styles.splitEqualTag}>
                      <Text style={styles.splitEqualTagText}>
                        {billSplitCalculation.hasItems ? 'Por Itens + Comum' : 'Divisão Igual'}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.splitResultsList}>
                    {billSplitCalculation.memberResults.map((r) => (
                      <View key={r.id} style={styles.splitResultRow}>
                        <View style={styles.splitResultAvatar}>
                          <Text style={styles.splitResultAvatarText}>{r.name.charAt(0).toUpperCase()}</Text>
                        </View>

                        <View style={{ flex: 1, marginHorizontal: 10 }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            <Text style={styles.splitResultName}>{r.name}</Text>
                            {r.isPayer && (
                              <View style={styles.payerBadge}>
                                <Text style={styles.payerBadgeText}>Pagou</Text>
                              </View>
                            )}
                          </View>

                          {billSplitCalculation.hasItems && (
                            <Text style={styles.splitResultDetailText}>
                              Itens: {formatMoney(r.itemsShare)} • Comum: {formatMoney(r.commonShare)}
                              {r.tipShare > 0 ? ` • Taxa: ${formatMoney(r.tipShare)}` : ''}
                            </Text>
                          )}
                        </View>

                        <Text style={styles.splitResultAmount}>{formatMoney(r.totalToPay)}</Text>
                      </View>
                    ))}
                  </View>

                  {/* Ações da Divisão */}
                  <View style={styles.splitActionsRow}>
                    <TouchableOpacity
                      style={styles.btnSplitSave}
                      onPress={handleSaveBillSplit}
                      activeOpacity={0.85}
                    >
                      <LinearGradient
                        colors={['#7C3AED', '#6D28D9']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={styles.btnSplitSaveGradient}
                      >
                        <Ionicons name="save-outline" size={18} color="#FFFFFF" />
                        <Text style={styles.btnSplitSaveText}>Salvar no Grupo</Text>
                      </LinearGradient>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.btnSplitShare}
                      onPress={handleShareBillSplit}
                      activeOpacity={0.8}
                    >
                      <Ionicons name="logo-whatsapp" size={18} color="#16A34A" />
                      <Text style={styles.btnSplitShareText}>WhatsApp</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </>
            )}

            {/* ============================================================== */}
            {/* ABA 3: ACERTO DE CONTAS                                        */}
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

                {/* PENDÊNCIAS PAR A PAR ENTRE MEMBROS DO GRUPO */}
                {debtsCalculation.pairwiseDebts && debtsCalculation.pairwiseDebts.length > 0 && (
                  <View style={{ marginBottom: 16 }}>
                    <Text style={styles.sectionTitle}>
                      Pendências entre Membros ({debtsCalculation.pairwiseDebts.length})
                    </Text>
                    {debtsCalculation.pairwiseDebts.map((item, idx) => (
                      <View key={idx} style={styles.pairwiseDebtRow}>
                        <View style={styles.pairwiseDebtAvatar}>
                          <Text style={styles.pairwiseDebtAvatarText}>
                            {item.from.charAt(0).toUpperCase()}
                          </Text>
                        </View>
                        <View style={{ flex: 1, marginHorizontal: 10 }}>
                          <Text style={styles.pairwiseDebtText}>
                            <Text style={{ fontWeight: '700', color: '#1E293B' }}>{item.from}</Text> deve para{' '}
                            <Text style={{ fontWeight: '700', color: '#7C3AED' }}>{item.to}</Text>
                          </Text>
                          <Text style={styles.pairwiseDebtSub}>Toque em quitar para registrar o acerto</Text>
                        </View>
                        <View style={{ alignItems: 'flex-end', gap: 4 }}>
                          <Text style={styles.pairwiseDebtAmount}>{formatMoney(item.amount)}</Text>
                          <TouchableOpacity
                            style={styles.pairwiseDebtBtn}
                            onPress={() => {
                              setSettleFrom(item.from);
                              setSettleTo(item.to);
                              setSettleAmount(String(item.amount));
                              setModalSettlement(true);
                            }}
                          >
                            <Text style={styles.pairwiseDebtBtnText}>Acertar</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    ))}
                  </View>
                )}

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

                    {isOwner ? (
                      <TouchableOpacity
                        style={styles.btnExcluirGrupo}
                        onPress={() => handleDeleteGroup(activeGroup?.id)}
                        activeOpacity={0.8}
                      >
                        <Ionicons name="trash-outline" size={16} color="#EF4444" />
                        <Text style={styles.btnExcluirGrupoText}>Excluir grupo</Text>
                      </TouchableOpacity>
                    ) : (
                      <TouchableOpacity
                        style={styles.btnSairGrupo}
                        onPress={() => handleLeaveGroup(activeGroup?.id)}
                        activeOpacity={0.8}
                      >
                        <Ionicons name="log-out-outline" size={16} color="#DC2626" />
                        <Text style={styles.btnSairGrupoText}>Sair do grupo</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>

                {/* CARD DE CÓDIGO ÚNICO DE CONVITE (VÁLIDO POR 30 MINUTOS) */}
                <View style={styles.inviteCodeCard}>
                  <View style={styles.inviteCodeCardHeader}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Ionicons name="key" size={16} color="#7C3AED" />
                      <Text style={styles.inviteCodeCardTitle}>Código de Convite Único</Text>
                    </View>
                    <View
                      style={[
                        styles.inviteCodeBadge,
                        inviteCodeStatus.isExpired
                          ? styles.inviteCodeBadgeExpired
                          : styles.inviteCodeBadgeActive,
                      ]}
                    >
                      <View
                        style={[
                          styles.statusDot,
                          { backgroundColor: inviteCodeStatus.isExpired ? '#EF4444' : '#10B981' },
                        ]}
                      />
                      <Text
                        style={[
                          styles.inviteCodeBadgeText,
                          { color: inviteCodeStatus.isExpired ? '#EF4444' : '#059669' },
                        ]}
                      >
                        {inviteCodeStatus.text}
                      </Text>
                    </View>
                  </View>

                  <Text style={styles.inviteCodeCardSub}>
                    Envie este código único para quem você deseja convidar. O código expira em 30 minutos por segurança.
                  </Text>

                  {/* Código em destaque com ações de Copiar e Compartilhar */}
                  <View style={styles.inviteCodeBox}>
                    <TouchableOpacity
                      onPress={async () => {
                        if (activeGroup?.inviteCode) {
                          await Clipboard.setStringAsync(activeGroup.inviteCode);
                          Alert.alert(
                            'Código Copiado! 📋',
                            `Código de Convite: ${activeGroup.inviteCode}\n\nO código foi copiado para a área de transferência. Envie para os membros que deseja convidar.`
                          );
                        }
                      }}
                      activeOpacity={0.7}
                      style={{ flex: 1, paddingVertical: 4 }}
                    >
                      <Text style={styles.inviteCodeText}>
                        {activeGroup?.inviteCode || '------'}
                      </Text>
                      <Text style={{ fontSize: 11, color: '#7C3AED', fontWeight: '600', marginTop: 2 }}>
                        Toque para copiar
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.shareCodeBtn}
                      onPress={() => {
                        Share.share({
                          message: `Olá! Estou te convidando para participar do grupo '${activeGroup?.name}' no app FINN. Baixe o app e entre com o código de convite: ${activeGroup?.inviteCode} (válido por 30 minutos).`,
                        });
                      }}
                      activeOpacity={0.8}
                    >
                      <Ionicons name="share-social" size={15} color="#FFFFFF" />
                      <Text style={styles.shareCodeBtnText}>Compartilhar</Text>
                    </TouchableOpacity>
                  </View>

                  {/* Botão de Gerar Novo Código de Convite */}
                  <TouchableOpacity
                    style={styles.btnRegenerateCode}
                    onPress={handleRegenerateInviteCode}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="refresh" size={15} color="#7C3AED" />
                    <Text style={styles.btnRegenerateCodeText}>Gerar novo código de convite</Text>
                  </TouchableOpacity>
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
                        {m.isCreator || m.role === 'OWNER' || m.role === 'ADMIN'
                          ? '👑 Criador(a)'
                          : 'Participante'}
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
      {/* MODAL 1: CRIAR GRUPO OU INGRESSAR COM CÓDIGO                   */}
      {/* ============================================================== */}
      <Modal visible={modalNewGroup} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {newGroupTab === 'create' ? 'Novo Grupo Financeiro' : 'Ingressar em um Grupo'}
              </Text>
              <TouchableOpacity onPress={() => setModalNewGroup(false)}>
                <Ionicons name="close" size={24} color="#71717A" />
              </TouchableOpacity>
            </View>

            {/* ABAS SELETORAS: CRIAR NOVO GRUPO vs EU TENHO UM CÓDIGO */}
            <View style={styles.modalTabsRow}>
              <TouchableOpacity
                style={[styles.modalTabBtn, newGroupTab === 'create' && styles.modalTabBtnActive]}
                onPress={() => setNewGroupTab('create')}
                activeOpacity={0.8}
              >
                <Ionicons
                  name="add-circle-outline"
                  size={16}
                  color={newGroupTab === 'create' ? '#7C3AED' : '#64748B'}
                />
                <Text
                  style={[
                    styles.modalTabBtnText,
                    newGroupTab === 'create' && styles.modalTabBtnTextActive,
                  ]}
                >
                  Criar novo grupo
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalTabBtn, newGroupTab === 'join' && styles.modalTabBtnActive]}
                onPress={() => setNewGroupTab('join')}
                activeOpacity={0.8}
              >
                <Ionicons
                  name="key-outline"
                  size={16}
                  color={newGroupTab === 'join' ? '#7C3AED' : '#64748B'}
                />
                <Text
                  style={[
                    styles.modalTabBtnText,
                    newGroupTab === 'join' && styles.modalTabBtnTextActive,
                  ]}
                >
                  Eu tenho um código
                </Text>
              </TouchableOpacity>
            </View>

            {/* ABA 1: FORMULÁRIO DE CRIAÇÃO DE GRUPO */}
            {newGroupTab === 'create' ? (
              <>
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
              </>
            ) : (
              /* ABA 2: FORMULÁRIO EU TENHO UM CÓDIGO COM BARRA E BOTÃO COLAR */
              <View style={{ marginTop: 4 }}>
                <Text style={styles.joinCodeSubText}>
                  Digite ou cole o código único de 6 caracteres fornecido pelo criador do grupo.
                </Text>

                <Text style={styles.inputLabel}>CÓDIGO DE CONVITE</Text>
                <View style={styles.codeInputBar}>
                  <Ionicons name="key" size={20} color="#7C3AED" style={{ marginLeft: 14 }} />
                  <TextInput
                    style={styles.codeTextInput}
                    placeholder="Ex: ABC123"
                    placeholderTextColor="#94A3B8"
                    value={joinCode}
                    onChangeText={(val) => setJoinCode(val.toUpperCase())}
                    autoCapitalize="characters"
                    maxLength={10}
                  />
                  <TouchableOpacity
                    style={styles.pasteCodeBtn}
                    onPress={async () => {
                      try {
                        const clipText = await Clipboard.getStringAsync();
                        if (clipText) {
                          const match = clipText.match(/[A-Z0-9]{5,8}/i);
                          const clean = (match ? match[0] : clipText).trim().toUpperCase();
                          setJoinCode(clean);
                        }
                      } catch (e) {
                        console.warn('Erro ao colar código:', e);
                      }
                    }}
                    activeOpacity={0.75}
                  >
                    <Ionicons name="clipboard-outline" size={15} color="#7C3AED" />
                    <Text style={styles.pasteCodeBtnText}>Colar</Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.codeTimerNotice}>
                  <Ionicons name="time-outline" size={15} color="#059669" />
                  <Text style={styles.codeTimerNoticeText}>
                    O código é único e tem validade de 30 minutos a partir do momento em que foi gerado.
                  </Text>
                </View>

                <TouchableOpacity
                  style={styles.btnModalPrimary}
                  onPress={async () => {
                    await handleJoin();
                    setModalNewGroup(false);
                  }}
                  activeOpacity={0.85}
                >
                  <Text style={styles.btnModalPrimaryText}>Ingressar no Grupo</Text>
                </TouchableOpacity>
              </View>
            )}
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

            {/* CÓDIGO DIRETO DE 30 MINUTOS */}
            <View style={{ backgroundColor: '#F5EEFD', borderRadius: 14, padding: 14, marginBottom: 14, borderWidth: 1, borderColor: '#DDD6FE' }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={{ fontSize: 11, fontWeight: '800', color: '#6D28D9' }}>CÓDIGO RÁPIDO (30 MIN)</Text>
                <Text style={{ fontSize: 11, fontWeight: '700', color: inviteCodeStatus.isExpired ? '#EF4444' : '#059669' }}>
                  {inviteCodeStatus.text}
                </Text>
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
                <Text style={{ fontSize: 22, fontWeight: '900', color: '#7C3AED', letterSpacing: 3, fontFamily: 'monospace' }}>
                  {activeGroup?.inviteCode || '------'}
                </Text>
                <TouchableOpacity
                  style={{ backgroundColor: '#7C3AED', paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10, flexDirection: 'row', alignItems: 'center', gap: 4 }}
                  onPress={() => {
                    Share.share({
                      message: `Olá! Estou te convidando para o grupo '${activeGroup?.name}' no FINN. Baixe o app e entre com o código: ${activeGroup?.inviteCode} (válido por 30 minutos).`,
                    });
                  }}
                  activeOpacity={0.8}
                >
                  <Ionicons name="share-social" size={13} color="#FFFFFF" />
                  <Text style={{ color: '#FFFFFF', fontSize: 12, fontWeight: '700' }}>Compartilhar</Text>
                </TouchableOpacity>
              </View>
              <TouchableOpacity
                style={{ marginTop: 10, alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 4 }}
                onPress={handleRegenerateInviteCode}
              >
                <Ionicons name="refresh" size={14} color="#7C3AED" />
                <Text style={{ color: '#7C3AED', fontSize: 11.5, fontWeight: '700' }}>Gerar outro código</Text>
              </TouchableOpacity>
            </View>

            <Text style={{ fontSize: 11, fontWeight: '800', color: '#94A3B8', textAlign: 'center', marginVertical: 6 }}>
              ── OU ENVIAR CONVITE POR E-MAIL ──
            </Text>

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

            <Text style={styles.inputLabel}>CÓDIGO DE CONVITE (VÁLIDO POR 30 MIN)</Text>
            <TextInput
              style={[styles.modalInput, { textAlign: 'center', fontSize: 24, fontWeight: '900', letterSpacing: 4, fontFamily: 'monospace', color: '#7C3AED' }]}
              placeholder="ABC123"
              placeholderTextColor="#CBD5E1"
              autoCapitalize="characters"
              maxLength={10}
              value={joinCode}
              onChangeText={setJoinCode}
            />
            <Text style={{ fontSize: 11.5, color: '#64748B', marginTop: 8, textAlign: 'center' }}>
              Insira o código único de 6 dígitos gerado pelo organizador do grupo (válido por 30 minutos).
            </Text>

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

            <TouchableOpacity
              style={styles.btnOpenSplitFromModal}
              onPress={() => {
                setModalNewExpense(false);
                if (expAmount) setSplitTotal(expAmount);
                if (expDesc) setSplitDesc(expDesc);
                setActiveTab('divisao');
              }}
              activeOpacity={0.8}
            >
              <Ionicons name="pie-chart-outline" size={16} color="#7C3AED" />
              <Text style={styles.btnOpenSplitFromModalText}>
                Divisão Detalhada por Itens / Seleção
              </Text>
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
  modalTabsRow: {
    flexDirection: 'row',
    backgroundColor: '#F3E8FF',
    borderRadius: 16,
    padding: 4,
    marginBottom: 16,
    gap: 4,
  },
  modalTabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 12,
  },
  modalTabBtnActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#7C3AED',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
    elevation: 3,
  },
  modalTabBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#64748B',
  },
  modalTabBtnTextActive: {
    color: '#7C3AED',
  },
  joinCodeSubText: {
    fontSize: 13.5,
    fontWeight: '500',
    color: '#475569',
    lineHeight: 20,
    marginBottom: 12,
  },
  codeInputBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    overflow: 'hidden',
    marginBottom: 12,
  },
  codeTextInput: {
    flex: 1,
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: 2,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  pasteCodeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#EDE9FE',
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 12,
    marginRight: 8,
  },
  pasteCodeBtnText: {
    fontSize: 12.5,
    fontWeight: '800',
    color: '#7C3AED',
  },
  codeTimerNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 9,
    marginBottom: 18,
  },
  codeTimerNoticeText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '600',
    color: '#059669',
    lineHeight: 16,
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
  btnSairGrupo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    paddingVertical: 10,
    borderRadius: 12,
  },
  btnSairGrupoText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#DC2626',
  },
  inviteCodeCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#EFEAF8',
    shadowColor: '#7C3AED',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 2,
  },
  inviteCodeCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  inviteCodeCardTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#18181B',
  },
  inviteCodeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  inviteCodeBadgeActive: {
    backgroundColor: '#ECFDF5',
  },
  inviteCodeBadgeExpired: {
    backgroundColor: '#FEF2F2',
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  inviteCodeBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  inviteCodeCardSub: {
    fontSize: 12,
    color: '#64748B',
    lineHeight: 16,
    marginBottom: 12,
  },
  inviteCodeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F7F5FC',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1.5,
    borderColor: '#DDD6FE',
    borderStyle: 'dashed',
    marginBottom: 10,
  },
  inviteCodeText: {
    fontSize: 22,
    fontWeight: '900',
    color: '#7C3AED',
    letterSpacing: 4,
    fontFamily: 'monospace',
  },
  shareCodeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#7C3AED',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  shareCodeBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  btnRegenerateCode: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#F5EEFD',
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#DDD6FE',
  },
  btnRegenerateCodeText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#7C3AED',
  },

  // BANNER DE DIVISÃO NO DASHBOARD
  billSplitBanner: {
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 14,
  },
  billSplitBannerGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    gap: 12,
  },
  billSplitBannerIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  billSplitBannerTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  billSplitBannerSub: {
    fontSize: 11.5,
    color: 'rgba(255,255,255,0.88)',
    marginTop: 2,
    lineHeight: 16,
  },
  btnOpenSplitFromModal: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 10,
    paddingVertical: 12,
    backgroundColor: '#F3E8FF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#DDD6FE',
  },
  btnOpenSplitFromModalText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#7C3AED',
  },

  // TELA DE DIVISÃO DE CONTAS (RACHADOR)
  splitHeaderCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: '#EFEAF8',
    marginBottom: 12,
  },
  splitHeaderIconBox: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: '#EDE9FE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  splitHeaderTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#1E293B',
  },
  splitHeaderSub: {
    fontSize: 11.5,
    color: '#64748B',
    marginTop: 2,
  },
  splitResetSmallBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
  },
  splitResetSmallBtnText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
  },
  splitFormCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: '#EFEAF8',
    marginBottom: 14,
  },
  splitFieldLabel: {
    fontSize: 10.5,
    fontWeight: '800',
    color: '#6D28D9',
    letterSpacing: 0.8,
  },
  splitInputDesc: {
    backgroundColor: '#FAF7FD',
    borderWidth: 1,
    borderColor: '#E9D5FF',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#1E293B',
    marginTop: 6,
  },
  splitInputTotalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FAF7FD',
    borderWidth: 1.5,
    borderColor: '#DDD6FE',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 4,
    marginTop: 6,
  },
  splitInputCurrency: {
    fontSize: 20,
    fontWeight: '800',
    color: '#7C3AED',
    marginRight: 6,
  },
  splitInputTotal: {
    flex: 1,
    fontSize: 24,
    fontWeight: '900',
    color: '#1E293B',
  },
  splitTipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
  },
  splitTipLabel: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '600',
  },
  splitTipChips: {
    flexDirection: 'row',
    gap: 6,
  },
  splitTipChip: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
  },
  splitTipChipActive: {
    backgroundColor: '#7C3AED',
  },
  splitTipChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
  },
  splitTipChipTextActive: {
    color: '#FFFFFF',
  },
  splitTipInfo: {
    fontSize: 11,
    fontWeight: '600',
    color: '#7C3AED',
    marginTop: 6,
  },
  splitPayerChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  splitPayerChipActive: {
    backgroundColor: '#EDE9FE',
    borderColor: '#C4B5FD',
  },
  splitPayerAvatar: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#CBD5E1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  splitPayerAvatarActive: {
    backgroundColor: '#7C3AED',
  },
  splitPayerAvatarText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#475569',
  },
  splitPayerAvatarTextActive: {
    color: '#FFFFFF',
  },
  splitPayerText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
  },
  splitPayerTextActive: {
    color: '#6D28D9',
  },
  splitMembersCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: '#EFEAF8',
    marginBottom: 14,
  },
  splitSectionTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  splitSectionTitle: {
    fontSize: 14.5,
    fontWeight: '800',
    color: '#1E293B',
  },
  splitSectionSub: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 1,
  },
  splitMiniActionBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: '#EDE9FE',
  },
  splitMiniActionText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#7C3AED',
  },
  splitMembersList: {
    gap: 8,
  },
  splitMemberToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 10,
    borderRadius: 14,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  splitMemberToggleRowActive: {
    backgroundColor: '#FAF5FF',
    borderColor: '#DDD6FE',
  },
  splitMemberAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  splitMemberAvatarActive: {
    backgroundColor: '#7C3AED',
  },
  splitMemberAvatarText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#475569',
  },
  splitMemberAvatarTextActive: {
    color: '#FFFFFF',
  },
  splitMemberName: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#334155',
  },
  splitMemberNameActive: {
    color: '#6D28D9',
  },
  splitMemberRole: {
    fontSize: 11,
    color: '#94A3B8',
  },
  splitItemsContainer: {
    marginBottom: 14,
  },
  splitItemsToggleCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: '#EFEAF8',
  },
  splitItemsToggleIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#FAF5FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  splitItemsToggleTitle: {
    fontSize: 13.5,
    fontWeight: '800',
    color: '#1E293B',
  },
  splitItemsToggleSub: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  splitItemsBox: {
    backgroundColor: '#FAF7FD',
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E9D5FF',
    marginTop: 8,
  },
  splitItemsBoxHint: {
    fontSize: 11.5,
    color: '#6D28D9',
    lineHeight: 16,
    marginBottom: 12,
  },
  newItemCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E9D5FF',
  },
  newItemLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#6D28D9',
    letterSpacing: 0.6,
    marginBottom: 4,
  },
  newItemInputRow: {
    flexDirection: 'row',
    gap: 8,
  },
  itemMemberChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
  },
  itemMemberChipActive: {
    backgroundColor: '#7C3AED',
  },
  itemMemberChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
  },
  itemMemberChipTextActive: {
    color: '#FFFFFF',
  },
  itemAssignHelp: {
    fontSize: 10.5,
    color: '#94A3B8',
    marginTop: 6,
    marginBottom: 8,
  },
  btnAddItemBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#7C3AED',
    paddingVertical: 8,
    borderRadius: 10,
  },
  btnAddItemBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  itemsListTitle: {
    fontSize: 12.5,
    fontWeight: '800',
    color: '#334155',
    marginBottom: 8,
  },
  splitItemRow: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    marginBottom: 6,
  },
  splitItemRowName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1E293B',
  },
  splitItemRowAssigned: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 1,
  },
  splitItemRowAmount: {
    fontSize: 13,
    fontWeight: '800',
    color: '#7C3AED',
  },
  splitItemRemoveBtn: {
    padding: 4,
  },
  diffBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EDE9FE',
    padding: 12,
    borderRadius: 12,
    marginTop: 8,
  },
  diffBannerTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#6D28D9',
  },
  diffBannerSub: {
    fontSize: 11,
    color: '#5B21B6',
    marginTop: 1,
  },
  diffBadge: {
    backgroundColor: '#7C3AED',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  diffBadgeText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  exceedBanner: {
    flexDirection: 'row',
    gap: 8,
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#FDE68A',
    padding: 10,
    borderRadius: 12,
    marginTop: 8,
  },
  exceedTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#92400E',
  },
  exceedSub: {
    fontSize: 11,
    color: '#78350F',
    marginTop: 1,
  },
  btnAjustarTotal: {
    backgroundColor: '#D97706',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    marginTop: 6,
    alignSelf: 'flex-start',
  },
  btnAjustarTotalText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  splitSummaryCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: '#EFEAF8',
    marginBottom: 20,
  },
  splitSummaryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  splitSummaryTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#1E293B',
  },
  splitSummarySub: {
    fontSize: 11.5,
    color: '#64748B',
    marginTop: 1,
  },
  splitEqualTag: {
    backgroundColor: '#EDE9FE',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  splitEqualTagText: {
    fontSize: 10.5,
    fontWeight: '800',
    color: '#7C3AED',
  },
  splitResultsList: {
    gap: 8,
    marginBottom: 14,
  },
  splitResultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FAF5FF',
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E9D5FF',
  },
  splitResultAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#7C3AED',
    alignItems: 'center',
    justifyContent: 'center',
  },
  splitResultAvatarText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  splitResultName: {
    fontSize: 13.5,
    fontWeight: '800',
    color: '#1E293B',
  },
  payerBadge: {
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  payerBadgeText: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#15803D',
  },
  splitResultDetailText: {
    fontSize: 11,
    color: '#6D28D9',
    marginTop: 2,
  },
  splitResultAmount: {
    fontSize: 16,
    fontWeight: '900',
    color: '#7C3AED',
  },
  splitActionsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 6,
  },
  btnSplitSave: {
    flex: 2,
    borderRadius: 14,
    overflow: 'hidden',
  },
  btnSplitSaveGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
  },
  btnSplitSaveText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  btnSplitShare: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#DCFCE7',
    borderWidth: 1,
    borderColor: '#86EFAC',
    borderRadius: 14,
    paddingVertical: 12,
  },
  btnSplitShareText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#15803D',
  },
  pairwiseDebtRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#EFEAF8',
    marginBottom: 8,
  },
  pairwiseDebtAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F3E8FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pairwiseDebtAvatarText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#7C3AED',
  },
  pairwiseDebtText: {
    fontSize: 13,
    color: '#334155',
  },
  pairwiseDebtSub: {
    fontSize: 10.5,
    color: '#94A3B8',
    marginTop: 1,
  },
  pairwiseDebtAmount: {
    fontSize: 13,
    fontWeight: '800',
    color: '#EF4444',
  },
  pairwiseDebtBtn: {
    backgroundColor: '#EDE9FE',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  pairwiseDebtBtnText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#7C3AED',
  },
});

