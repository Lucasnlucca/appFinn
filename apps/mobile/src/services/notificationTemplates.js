/**
 * Camada central de modelos, validação e templates de notificações do FINN.
 * Garante que nenhum título ou corpo contenha "undefined", "null", campos vazios,
 * emojis em títulos ou nomes de categoria sem acentuação correta em pt-BR.
 */

export const NOTIFICATION_CATEGORIES = {
  GASTOS: 'gastos',
  IA: 'ia',
  LEMBRETES: 'lembretes',
  SISTEMA: 'sistema',
};

export const NOTIFICATION_PRIORITIES = {
  NORMAL: 'normal',
  HIGH: 'high',
  CRITICAL: 'critical',
};

export const CATEGORY_LABELS_PT = {
  alimentacao: 'Alimentação',
  'alimentação': 'Alimentação',
  food: 'Alimentação',
  restaurante: 'Alimentação',
  mercado: 'Alimentação',
  supermercado: 'Alimentação',
  moradia: 'Moradia',
  casa: 'Moradia',
  aluguel: 'Moradia',
  condominio: 'Moradia',
  'condomínio': 'Moradia',
  energia: 'Moradia',
  agua: 'Moradia',
  'água': 'Moradia',
  internet: 'Moradia',
  transporte: 'Transporte',
  combustivel: 'Transporte',
  'combustível': 'Transporte',
  uber: 'Transporte',
  mobilidade: 'Transporte',
  lazer: 'Lazer',
  entretenimento: 'Lazer',
  viagem: 'Lazer',
  saude: 'Saúde',
  'saúde': 'Saúde',
  farmacia: 'Saúde',
  'farmácia': 'Saúde',
  academia: 'Saúde',
  educacao: 'Educação',
  'educação': 'Educação',
  cursos: 'Educação',
  faculdade: 'Educação',
  escola: 'Educação',
  assinaturas: 'Assinaturas',
  streaming: 'Assinaturas',
  servicos: 'Serviços',
  'serviços': 'Serviços',
  compras: 'Compras',
  vestuario: 'Vestuário',
  'vestuário': 'Vestuário',
  investimentos: 'Investimentos',
  cofrinho: 'Cofrinhos',
  cofrinhos: 'Cofrinhos',
  salario: 'Salário',
  'salário': 'Salário',
  renda: 'Salário',
  freelance: 'Renda Extra',
  freela: 'Renda Extra',
  outros: 'Outros',
  geral: 'Outros',
};

const EMOJI_REGEX =
  /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F1E6}-\u{1F1FF}\u{1F600}-\u{1F64F}\u{1F680}-\u{1F6FF}\u{FE00}-\u{FE0F}\u{200D}]/gu;

/**
 * Formata valores numéricos de forma determinística no padrão monetário brasileiro (R$ 1.234,56)
 */
export function formatCurrencyBRL(value) {
  const num = Number(value);
  const safeNum = Number.isFinite(num) ? num : 0;
  const isNegative = safeNum < 0;
  const abs = Math.abs(safeNum);
  const fixed = abs.toFixed(2);
  const [intPart, decPart] = fixed.split('.');
  const formattedInt = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${isNegative ? '-R$ ' : 'R$ '}${formattedInt},${decPart}`;
}

/**
 * Normaliza qualquer identificador de categoria para o nome acentuado correto em português
 */
export function getCategoryLabelPt(rawCategory, fallback = 'Outros') {
  if (rawCategory === null || rawCategory === undefined) return fallback;
  const str = String(rawCategory).trim();
  if (!str || str.toLowerCase() === 'undefined' || str.toLowerCase() === 'null') {
    return fallback;
  }
  const key = str.toLowerCase();
  if (CATEGORY_LABELS_PT[key]) {
    return CATEGORY_LABELS_PT[key];
  }
  // Remove acentos para buscar chave equivalente
  const normalizedKey = key.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  if (CATEGORY_LABELS_PT[normalizedKey]) {
    return CATEGORY_LABELS_PT[normalizedKey];
  }
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Sanitiza textos para garantir que nunca exibam "undefined", "null", "(undefined)" ou espaços vazios.
 */
export function sanitizeNotificationText(rawText, fallback = '', { stripEmojis = false } = {}) {
  if (rawText === null || rawText === undefined) return fallback;
  let cleaned = String(rawText)
    .replace(/\(\s*(?:undefined|null)\s*\)/gi, '')
    .replace(/\b(?:undefined|null|NaN)\b/gi, '')
    .replace(/\balimentacao\b/gi, 'Alimentação')
    .replace(/\bsaude\b/gi, 'Saúde')
    .replace(/\beducacao\b/gi, 'Educação')
    .replace(/\bsalario\b/gi, 'Salário');

  if (stripEmojis) {
    cleaned = cleaned.replace(EMOJI_REGEX, '');
  }

  cleaned = cleaned
    .replace(/\s{2,}/g, ' ')
    .replace(/\s+([.,!?;:])/g, '$1')
    .replace(/^[\s\-:•|]+/, '')
    .trim();

  return cleaned.length > 0 ? cleaned : fallback;
}

/**
 * Normaliza categoria legada ('expense' | 'economy' | 'ai' | 'reminder' | 'group' | 'system' | 'update')
 * para uma das 4 categorias oficiais: 'gastos' | 'ia' | 'lembretes' | 'sistema'
 */
export function normalizeNotificationCategory(rawCategory) {
  const c = String(rawCategory || '').toLowerCase().trim();
  if (c === 'gastos' || c === 'expense' || c === 'income' || c === 'economy' || c === 'control') {
    return NOTIFICATION_CATEGORIES.GASTOS;
  }
  if (c === 'ia' || c === 'ai' || c === 'insight') {
    return NOTIFICATION_CATEGORIES.IA;
  }
  if (c === 'lembretes' || c === 'reminder' || c === 'bills') {
    return NOTIFICATION_CATEGORIES.LEMBRETES;
  }
  if (c === 'sistema' || c === 'system' || c === 'update' || c === 'group') {
    return NOTIFICATION_CATEGORIES.SISTEMA;
  }
  return NOTIFICATION_CATEGORIES.GASTOS;
}

/**
 * Retorna a paleta visual do chip de ícone de acordo com a categoria oficial
 */
export function getCategoryVisualStyle(category, customIcon) {
  const normalized = normalizeNotificationCategory(category);
  switch (normalized) {
    case NOTIFICATION_CATEGORIES.GASTOS:
      return {
        color: '#B91C1C',
        bgColor: '#FEE2E2',
        icon: customIcon || 'trending-down-outline',
      };
    case NOTIFICATION_CATEGORIES.IA:
      return {
        color: '#5B21B6',
        bgColor: '#EDE9FE',
        icon: customIcon || 'sparkles-outline',
      };
    case NOTIFICATION_CATEGORIES.LEMBRETES:
      return {
        color: '#0369A1',
        bgColor: '#E0F2FE',
        icon: customIcon || 'notifications-outline',
      };
    case NOTIFICATION_CATEGORIES.SISTEMA:
    default:
      return {
        color: '#15803D',
        bgColor: '#DCFCE7',
        icon: customIcon || 'arrow-up-circle-outline',
      };
  }
}

function resolveDateIso(dateInput) {
  if (!dateInput) return new Date().toISOString();
  const parsed = new Date(dateInput);
  return Number.isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString();
}

function resolveTimeLabel(timeInput, createdAtIso) {
  if (timeInput && sanitizeNotificationText(timeInput)) {
    return sanitizeNotificationText(timeInput);
  }
  try {
    const d = new Date(createdAtIso);
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    return `${hh}:${mm}`;
  } catch (e) {
    return 'Agora';
  }
}

/**
 * Construtor base validado de uma notificação padronizada
 */
export function createNotificationModel({
  id,
  type = 'generic',
  category = NOTIFICATION_CATEGORIES.SISTEMA,
  title,
  body,
  action = null,
  priority = NOTIFICATION_PRIORITIES.NORMAL,
  createdAt,
  time,
  icon,
  color,
  bgColor,
  isHeroAi = false,
  badge = null,
  section = null,
  dedupeKey = null,
  lockScreenTitle = null,
  lockScreenBody = null,
  meta = {},
}) {
  const normalizedCategory = normalizeNotificationCategory(category);
  const visuals = getCategoryVisualStyle(normalizedCategory, icon);
  const safeCreatedAt = resolveDateIso(createdAt);
  const dayKey = safeCreatedAt.slice(0, 10);

  const safeTitle = sanitizeNotificationText(title, 'Notificação FINN', { stripEmojis: true });
  const safeBody = sanitizeNotificationText(
    body,
    'Confira os detalhes atualizados no seu painel financeiro.'
  );

  const resolvedAction =
    action && typeof action === 'object' && action.targetScreen
      ? {
          label: sanitizeNotificationText(action.label, 'Abrir', { stripEmojis: true }),
          targetScreen: String(action.targetScreen),
          params: action.params || {},
        }
      : null;

  const resolvedDedupeKey =
    sanitizeNotificationText(dedupeKey) || `${type}:${safeTitle}:${dayKey}`;

  return {
    id: sanitizeNotificationText(id, `notif-${type}-${Date.now()}`),
    type: sanitizeNotificationText(type, 'generic'),
    category: normalizedCategory,
    title: safeTitle,
    body: safeBody,
    message: safeBody, // compatibilidade com componentes existentes
    action: resolvedAction,
    targetScreen: resolvedAction ? resolvedAction.targetScreen : null,
    ctaLabel: resolvedAction ? resolvedAction.label : null,
    priority: Object.values(NOTIFICATION_PRIORITIES).includes(priority)
      ? priority
      : NOTIFICATION_PRIORITIES.NORMAL,
    createdAt: safeCreatedAt,
    time: resolveTimeLabel(time, safeCreatedAt),
    icon: color && icon ? icon : visuals.icon,
    color: color || visuals.color,
    bgColor: bgColor || visuals.bgColor,
    isHeroAi: Boolean(isHeroAi),
    badge: badge ? sanitizeNotificationText(badge, 'INSIGHT DA FINN IA', { stripEmojis: true }) : null,
    section: section || (normalizedCategory === NOTIFICATION_CATEGORIES.SISTEMA ? 'SISTEMA' : null),
    dedupeKey: resolvedDedupeKey,
    lockScreenTitle: sanitizeNotificationText(
      lockScreenTitle,
      normalizedCategory === NOTIFICATION_CATEGORIES.GASTOS
        ? 'Nova movimentação financeira'
        : safeTitle,
      { stripEmojis: true }
    ),
    lockScreenBody: sanitizeNotificationText(
      lockScreenBody,
      'Abra o aplicativo FINN para visualizar os detalhes com segurança.'
    ),
    meta: meta || {},
  };
}

/**
 * ============================================================================
 * TEMPLATES OFICIAIS (ETAPA 1)
 * ============================================================================
 */
export const NotificationTemplates = {
  /**
   * 1. TRANSACIONAIS
   */
  transactionRecorded({
    id,
    txId,
    type = 'expense',
    amount = 0,
    category = 'alimentacao',
    description = '',
    createdAt,
    time,
  } = {}) {
    const isIncome = String(type).toLowerCase() === 'income';
    const formattedAmount = formatCurrencyBRL(amount);
    const categoryLabel = getCategoryLabelPt(category, isIncome ? 'Salário' : 'Alimentação');
    const cleanDesc = sanitizeNotificationText(description, '', { stripEmojis: true });
    const refId = sanitizeNotificationText(txId || id, `${type}-${Number(amount) || 0}`);

    if (isIncome) {
      return createNotificationModel({
        id: id || `tx-inc-${refId}`,
        type: 'transaction_income',
        category: NOTIFICATION_CATEGORIES.GASTOS,
        title: `Receita de ${formattedAmount}`,
        body: `Receita de ${formattedAmount} em ${categoryLabel} registrada com sucesso.`,
        action: { label: 'Abrir', targetScreen: 'Transactions' },
        priority: NOTIFICATION_PRIORITIES.NORMAL,
        createdAt,
        time,
        icon: 'trending-up-outline',
        color: '#15803D',
        bgColor: '#DCFCE7',
        dedupeKey: `transaction_income:${refId}:${resolveDateIso(createdAt).slice(0, 10)}`,
        lockScreenTitle: 'Nova receita registrada',
        lockScreenBody: `Uma nova receita em ${categoryLabel} foi registrada na sua conta.`,
        meta: { amount: Number(amount) || 0, category: categoryLabel, description: cleanDesc },
      });
    }

    return createNotificationModel({
      id: id || `tx-exp-${refId}`,
      type: 'transaction_expense',
      category: NOTIFICATION_CATEGORIES.GASTOS,
      title: `Gasto de ${formattedAmount}`,
      body: `Gasto de ${formattedAmount} em ${categoryLabel} registrado. Fique de olho no limite mensal.`,
      action: { label: 'Abrir', targetScreen: 'Transactions' },
      priority: NOTIFICATION_PRIORITIES.NORMAL,
      createdAt,
      time,
      icon: 'trending-down-outline',
      color: '#B91C1C',
      bgColor: '#FEE2E2',
      dedupeKey: `transaction_expense:${refId}:${resolveDateIso(createdAt).slice(0, 10)}`,
      lockScreenTitle: 'Novo gasto registrado',
      lockScreenBody: `Um novo gasto em ${categoryLabel} foi registrado na sua conta.`,
      meta: { amount: Number(amount) || 0, category: categoryLabel, description: cleanDesc },
    });
  },

  receiptProcessed({ id, txId, amount = 0, category = 'alimentacao', merchant = '', createdAt, time } = {}) {
    const formattedAmount = formatCurrencyBRL(amount);
    const categoryLabel = getCategoryLabelPt(category, 'Alimentação');
    const cleanMerchant = sanitizeNotificationText(merchant, '', { stripEmojis: true });
    const refId = sanitizeNotificationText(txId || id, `${Number(amount) || 0}-${categoryLabel}`);

    return createNotificationModel({
      id: id || `receipt-ok-${refId}`,
      type: 'receipt_processed',
      category: NOTIFICATION_CATEGORIES.IA,
      title: 'Comprovante processado pela IA',
      body: cleanMerchant
        ? `Gasto de ${formattedAmount} em ${categoryLabel} (${cleanMerchant}) registrado com sucesso.`
        : `Gasto de ${formattedAmount} em ${categoryLabel} identificado e registrado com sucesso.`,
      action: { label: 'Abrir', targetScreen: 'Transactions' },
      priority: NOTIFICATION_PRIORITIES.NORMAL,
      createdAt,
      time,
      icon: 'document-text-outline',
      dedupeKey: `receipt_processed:${refId}:${resolveDateIso(createdAt).slice(0, 10)}`,
      lockScreenTitle: 'Comprovante processado pela IA',
      lockScreenBody: 'Seu comprovante foi lido e registrado automaticamente.',
    });
  },

  receiptFailed({ id, reason = '', createdAt, time } = {}) {
    const cleanReason = sanitizeNotificationText(reason, '', { stripEmojis: true });
    return createNotificationModel({
      id: id || `receipt-fail-${Date.now()}`,
      type: 'receipt_failed',
      category: NOTIFICATION_CATEGORIES.IA,
      title: 'Não foi possível ler o comprovante',
      body: cleanReason
        ? `${cleanReason}. Envie uma imagem mais nítida ou registre manualmente.`
        : 'Envie uma foto mais nítida do comprovante ou informe o valor para a FINN IA.',
      action: { label: 'Abrir', targetScreen: 'FinnAI' },
      priority: NOTIFICATION_PRIORITIES.NORMAL,
      createdAt,
      time,
      icon: 'alert-circle-outline',
      dedupeKey: `receipt_failed:default:${resolveDateIso(createdAt).slice(0, 10)}`,
      lockScreenTitle: 'Atenção ao comprovante enviado',
      lockScreenBody: 'Não conseguimos ler todos os dados do comprovante. Toque para revisar.',
    });
  },

  /**
   * 2. ALERTAS DE CONTROLE
   */
  categoryBudgetAlert({
    id,
    category = 'alimentacao',
    percentage = 80,
    spent = 0,
    limit = 0,
    month = '',
    createdAt,
    time,
  } = {}) {
    const categoryLabel = getCategoryLabelPt(category, 'Outros');
    const safePct = Math.max(0, Math.round(Number(percentage) || 0));
    const isFull = safePct >= 100;
    const thresholdTag = isFull ? '100' : '80';
    const formattedSpent = formatCurrencyBRL(spent);
    const formattedLimit = formatCurrencyBRL(limit);
    const monthRef = sanitizeNotificationText(month, resolveDateIso(createdAt).slice(0, 7));

    return createNotificationModel({
      id: id || `budget-${thresholdTag}-${categoryLabel.toLowerCase()}-${monthRef}`,
      type: isFull ? 'category_limit_100' : 'category_limit_80',
      category: NOTIFICATION_CATEGORIES.GASTOS,
      title: isFull
        ? `Limite de ${categoryLabel} atingido`
        : `Limite de ${categoryLabel} em ${safePct}%`,
      body:
        Number(limit) > 0
          ? `Você utilizou ${formattedSpent} de ${formattedLimit} planejados para ${categoryLabel} neste mês.`
          : `Seus gastos em ${categoryLabel} atingiram ${safePct}% do orçamento mensal.`,
      action: { label: 'Abrir', targetScreen: 'Planning' },
      priority: isFull ? NOTIFICATION_PRIORITIES.HIGH : NOTIFICATION_PRIORITIES.NORMAL,
      createdAt,
      time,
      icon: 'pie-chart-outline',
      color: '#B91C1C',
      bgColor: '#FEE2E2',
      dedupeKey: `category_limit_${thresholdTag}:${categoryLabel}:${monthRef}`,
      lockScreenTitle: isFull
        ? `Limite de ${categoryLabel} atingido`
        : `Alerta de orçamento em ${categoryLabel}`,
      lockScreenBody: `Confira o acompanhamento do seu orçamento mensal de ${categoryLabel}.`,
    });
  },

  unusualExpenseAlert({
    id,
    txId,
    amount = 0,
    category = 'outros',
    averageAmount = 0,
    createdAt,
    time,
  } = {}) {
    const categoryLabel = getCategoryLabelPt(category, 'Outros');
    const formattedAmount = formatCurrencyBRL(amount);
    const formattedAvg = formatCurrencyBRL(averageAmount);
    const ref = sanitizeNotificationText(txId || id, categoryLabel);

    return createNotificationModel({
      id: id || `unusual-exp-${ref}`,
      type: 'unusual_expense',
      category: NOTIFICATION_CATEGORIES.GASTOS,
      title: `Gasto acima da média em ${categoryLabel}`,
      body:
        Number(averageAmount) > 0
          ? `O lançamento de ${formattedAmount} está acima da sua média de ${formattedAvg} em ${categoryLabel}.`
          : `O lançamento de ${formattedAmount} está acima do seu padrão habitual em ${categoryLabel}.`,
      action: { label: 'Abrir', targetScreen: 'Transactions' },
      priority: NOTIFICATION_PRIORITIES.HIGH,
      createdAt,
      time,
      icon: ' pulse-outline'.trim(),
      color: '#B91C1C',
      bgColor: '#FEE2E2',
      dedupeKey: `unusual_expense:${ref}:${resolveDateIso(createdAt).slice(0, 10)}`,
      lockScreenTitle: `Gasto fora do padrão em ${categoryLabel}`,
      lockScreenBody: 'Identificamos uma despesa acima da sua média habitual nesta categoria.',
    });
  },

  lowBalanceOrNegativeProjectionAlert({
    id,
    currentBalance = 0,
    projectedBalance = 0,
    month = '',
    createdAt,
    time,
  } = {}) {
    const cur = Number(currentBalance) || 0;
    const proj = Number(projectedBalance) || 0;
    const isNegativeNow = cur < 0;
    const monthRef = sanitizeNotificationText(month, resolveDateIso(createdAt).slice(0, 7));

    return createNotificationModel({
      id: id || `balance-alert-${monthRef}`,
      type: isNegativeNow ? 'negative_balance' : 'negative_projection',
      category: NOTIFICATION_CATEGORIES.GASTOS,
      title: isNegativeNow ? 'Saldo atual negativo' : 'Atenção à projeção do mês',
      body: isNegativeNow
        ? `Seu saldo está em ${formatCurrencyBRL(cur)}. Revise suas despesas para reequilibrar o caixa.`
        : `Considerando as contas pendentes, sua projeção é de ${formatCurrencyBRL(proj)}. Planeje os próximos dias.`,
      action: { label: 'Abrir', targetScreen: 'Planning' },
      priority: NOTIFICATION_PRIORITIES.CRITICAL,
      createdAt,
      time,
      icon: 'alert-circle-outline',
      color: '#B91C1C',
      bgColor: '#FEE2E2',
      dedupeKey: `balance_alert:${isNegativeNow ? 'neg' : 'proj'}:${ resolveDateIso(createdAt).slice(0, 10)}`,
      lockScreenTitle: 'Alerta importante de saldo',
      lockScreenBody: 'Recomendamos revisar seu planejamento financeiro deste mês.',
    });
  },

  billDueAlert({
    id,
    billId,
    billTitle = 'Conta mensal',
    amount = 0,
    daysUntilDue = 0,
    createdAt,
    time,
  } = {}) {
    const cleanBillTitle = sanitizeNotificationText(billTitle, 'Conta mensal', { stripEmojis: true });
    const formattedAmount = formatCurrencyBRL(amount);
    const days = Number.isFinite(Number(daysUntilDue)) ? Math.round(Number(daysUntilDue)) : 0;
    const isDueToday = days <= 0;
    const ref = sanitizeNotificationText(billId || id, cleanBillTitle);

    return createNotificationModel({
      id: id || `bill-due-${ref}-${isDueToday ? 'today' : '3d'}`,
      type: isDueToday ? 'bill_due_today' : 'bill_due_soon',
      category: NOTIFICATION_CATEGORIES.LEMBRETES,
      title: isDueToday
        ? `Conta vence hoje: ${cleanBillTitle}`
        : `Conta a vencer em ${days} ${days === 1 ? 'dia' : 'dias'}`,
      body: isDueToday
        ? `O pagamento de ${cleanBillTitle} (${formattedAmount}) vence hoje. Evite juros e multas.`
        : `A conta ${cleanBillTitle} no valor de ${formattedAmount} vence em ${days} ${days === 1 ? 'dia' : 'dias'}.`,
      action: { label: 'Abrir', targetScreen: 'MonthlyAgenda' },
      priority: isDueToday ? NOTIFICATION_PRIORITIES.CRITICAL : NOTIFICATION_PRIORITIES.HIGH,
      createdAt,
      time: time || (isDueToday ? 'Hoje' : `Em ${days}d`),
      icon: 'calendar-outline',
      dedupeKey: `bill_due:${ref}:${isDueToday ? 'today' : 'soon'}:${resolveDateIso(createdAt).slice(0, 10)}`,
      lockScreenTitle: isDueToday ? 'Você tem uma conta vencendo hoje' : 'Lembrete de vencimento próximo',
      lockScreenBody: `Confira sua Agenda do Mês para acompanhar o vencimento de ${cleanBillTitle}.`,
    });
  },

  /**
   * 3. INSIGHTS DA FINN IA
   */
  aiSavingsOpportunity({
    id,
    savedPercent = 100,
    freeBalance = 0,
    month = '',
    createdAt,
    time = 'Agora',
  } = {}) {
    const pct = Math.max(0, Math.min(100, Math.round(Number(savedPercent) || 0)));
    const formattedFree = formatCurrencyBRL(Math.max(0, Number(freeBalance) || 0));
    const monthRef = sanitizeNotificationText(month, resolveDateIso(createdAt).slice(0, 7));

    return createNotificationModel({
      id: id || `ai-savings-opp-${monthRef}`,
      type: 'ai_savings_opportunity',
      category: NOTIFICATION_CATEGORIES.IA,
      isHeroAi: true,
      badge: 'INSIGHT DA FINN IA',
      title:
        pct > 0
          ? `Você guardou ${pct}% da sua renda este mês`
          : 'Oportunidade para organizar sua reserva este mês',
      body: `Saldo livre de ${formattedFree}. Que tal separar uma parte nos Cofrinhos?`,
      action: { label: 'Ver Cofrinhos', targetScreen: 'Cofrinhos' },
      priority: NOTIFICATION_PRIORITIES.NORMAL,
      createdAt,
      time,
      icon: 'sparkles-outline',
      color: '#5B21B6',
      bgColor: '#EDE9FE',
      dedupeKey: `ai_savings_opportunity:${monthRef}:${resolveDateIso(createdAt).slice(0, 10)}`,
      lockScreenTitle: 'Novo insight da FINN IA disponível',
      lockScreenBody: 'A FINN IA analisou seu mês e encontrou uma oportunidade para seus Cofrinhos.',
    });
  },

  aiWeeklySummary({
    id,
    totalSpent = 0,
    topCategory = 'alimentacao',
    savedAmount = 0,
    weekRef = '',
    createdAt,
    time,
  } = {}) {
    const formattedSpent = formatCurrencyBRL(totalSpent);
    const formattedSaved = formatCurrencyBRL(savedAmount);
    const categoryLabel = getCategoryLabelPt(topCategory, 'Alimentação');
    const safeWeek = sanitizeNotificationText(weekRef, resolveDateIso(createdAt).slice(0, 10));

    return createNotificationModel({
      id: id || `ai-weekly-${safeWeek}`,
      type: 'ai_weekly_summary',
      category: NOTIFICATION_CATEGORIES.IA,
      title: 'Resumo semanal da FINN IA',
      body:
        Number(savedAmount) > 0
          ? `Você gastou ${formattedSpent} na semana (maior foco em ${categoryLabel}) e manteve ${formattedSaved} livres.`
          : `Seus gastos na semana somaram ${formattedSpent}, com maior concentração em ${categoryLabel}.`,
      action: { label: 'Abrir', targetScreen: 'Planning' },
      priority: NOTIFICATION_PRIORITIES.NORMAL,
      createdAt,
      time: time || 'Semana',
      icon: 'sparkles-outline',
      dedupeKey: `ai_weekly_summary:${safeWeek}`,
      lockScreenTitle: 'Seu resumo semanal da FINN IA chegou',
      lockScreenBody: 'Veja como foi o comportamento das suas finanças nesta semana.',
    });
  },

  aiGoalProgress({
    id,
    goalId,
    goalTitle = 'Cofrinho',
    currentAmount = 0,
    targetAmount = 0,
    percent = 80,
    createdAt,
    time,
  } = {}) {
    const cleanTitle = sanitizeNotificationText(goalTitle, 'Cofrinho', { stripEmojis: true });
    const safePct = Math.max(0, Math.min(100, Math.round(Number(percent) || 0)));
    const isCompleted = safePct >= 100;
    const formattedCurrent = formatCurrencyBRL(currentAmount);
    const formattedTarget = formatCurrencyBRL(targetAmount);
    const ref = sanitizeNotificationText(goalId || id, cleanTitle);

    return createNotificationModel({
      id: id || `ai-goal-${ref}-${isCompleted ? '100' : 'near'}`,
      type: isCompleted ? 'ai_goal_reached' : 'ai_goal_near',
      category: NOTIFICATION_CATEGORIES.IA,
      title: isCompleted ? `Meta atingida: ${cleanTitle}` : `Meta quase atingida: ${cleanTitle}`,
      body: isCompleted
        ? `Parabéns! Você alcançou 100% da meta ${cleanTitle} (${formattedTarget}) nos Cofrinhos.`
        : `Você já completou ${safePct}% da meta ${cleanTitle} (${formattedCurrent} de ${formattedTarget}).`,
      action: { label: 'Ver Cofrinhos', targetScreen: 'Cofrinhos' },
      priority: NOTIFICATION_PRIORITIES.NORMAL,
      createdAt,
      time: time || 'Agora',
      icon: 'trophy-outline',
      dedupeKey: `ai_goal:${ref}:${isCompleted ? '100' : '80'}:${resolveDateIso(createdAt).slice(0, 10)}`,
      lockScreenTitle: isCompleted ? 'Parabéns! Você atingiu uma meta' : 'Sua meta está quase concluída',
      lockScreenBody: `Confira o progresso da meta ${cleanTitle} nos seus Cofrinhos.`,
    });
  },

  /**
   * 4. LEMBRETES
   */
  dailyRegisterReminder({ id, createdAt, time = 'Diário' } = {}) {
    const dayKey = resolveDateIso(createdAt).slice(0, 10);
    return createNotificationModel({
      id: id || 'smart-reminder-daily',
      type: 'reminder_daily_register',
      category: NOTIFICATION_CATEGORIES.LEMBRETES,
      title: 'Registre suas despesas',
      body: 'Comprou no Pix, cartão ou dinheiro? Envie o comprovante para a FINN IA.',
      action: { label: 'Abrir', targetScreen: 'FinnAI' },
      priority: NOTIFICATION_PRIORITIES.NORMAL,
      createdAt,
      time,
      icon: 'notifications-outline',
      color: '#0369A1',
      bgColor: '#E0F2FE',
      dedupeKey: `reminder_daily_register:daily:${dayKey}`,
      lockScreenTitle: 'Registre suas despesas do dia',
      lockScreenBody: 'Envie comprovantes ou áudios para a FINN IA manter seu controle em dia.',
    });
  },

  reengagementReminder({ id, daysInactive = 3, createdAt, time } = {}) {
    const days = Math.max(3, Math.min(30, Math.round(Number(daysInactive) || 3)));
    const dayKey = resolveDateIso(createdAt).slice(0, 10);
    return createNotificationModel({
      id: id || `reminder-reengage-${dayKey}`,
      type: 'reminder_reengagement',
      category: NOTIFICATION_CATEGORIES.LEMBRETES,
      title: 'Que tal atualizar suas finanças hoje?',
      body: `Faz ${days} dias que você não registra movimentações. Leva menos de 1 minuto com a FINN IA.`,
      action: { label: 'Abrir', targetScreen: 'FinnAI' },
      priority: NOTIFICATION_PRIORITIES.NORMAL,
      createdAt,
      time: time || `Há ${days}d`,
      icon: 'time-outline',
      color: '#0369A1',
      bgColor: '#E0F2FE',
      dedupeKey: `reminder_reengagement:${days}d:${dayKey}`,
      lockScreenTitle: 'Mantenha seu planejamento em dia',
      lockScreenBody: 'Abra o FINN e atualize seus lançamentos da semana em segundos.',
    });
  },

  /**
   * 5. SISTEMA & FINANÇAS COMPARTILHADAS
   */
  systemAppUpdated({ id, version = '1.0.0', createdAt } = {}) {
    const cleanVer = sanitizeNotificationText(version, '1.0.0', { stripEmojis: true });
    return createNotificationModel({
      id: id || 'smart-update-app',
      type: 'system_app_updated',
      category: NOTIFICATION_CATEGORIES.SISTEMA,
      section: 'SISTEMA',
      title: 'App atualizado',
      body: 'Novidades na Carteira FINN, Finanças Compartilhadas e IA.',
      action: null,
      priority: NOTIFICATION_PRIORITIES.NORMAL,
      createdAt,
      time: '',
      icon: 'arrow-up-circle-outline',
      color: '#15803D',
      bgColor: '#DCFCE7',
      dedupeKey: `system_app_updated:${cleanVer}`,
      lockScreenTitle: 'FINN atualizado com novidades',
      lockScreenBody: 'Confira as melhorias na Carteira FINN, Finanças Compartilhadas e IA.',
    });
  },

  systemFeatureNews({ id, title, body, targetScreen = 'Planning', createdAt, time } = {}) {
    const cleanTitle = sanitizeNotificationText(title, 'Novidades no FINN', { stripEmojis: true });
    const cleanBody = sanitizeNotificationText(
      body,
      'Explore os novos recursos de controle inteligente de cartões e metas.'
    );
    return createNotificationModel({
      id: id || `sys-news-${Date.now()}`,
      type: 'system_feature_news',
      category: NOTIFICATION_CATEGORIES.SISTEMA,
      section: 'SISTEMA',
      title: cleanTitle,
      body: cleanBody,
      action: targetScreen ? { label: 'Abrir', targetScreen } : null,
      priority: NOTIFICATION_PRIORITIES.NORMAL,
      createdAt,
      time: time || '',
      icon: 'sparkles-outline',
      color: '#15803D',
      bgColor: '#DCFCE7',
      dedupeKey: `system_feature_news:${cleanTitle}`,
    });
  },

  sharedGroupInvite({
    id,
    groupName = 'Casal',
    invitedEmail = '',
    inviteCode = '',
    pendingCount = 1,
    isReceived = false,
    createdAt,
    time,
  } = {}) {
    const cleanGroup = sanitizeNotificationText(groupName, 'Compartilhado', { stripEmojis: true });
    const cleanEmail = sanitizeNotificationText(invitedEmail, 'participante');
    const cleanCode = sanitizeNotificationText(inviteCode, '');
    const count = Math.max(1, Math.round(Number(pendingCount) || 1));

    const title = isReceived
      ? `Convite para o grupo ${cleanGroup}`
      : count > 1
      ? `Convites de grupo ativos (${count})`
      : `Convite enviado para ${cleanGroup}`;

    const body = isReceived
      ? `Você recebeu um convite para participar do grupo ${cleanGroup} nas Finanças Compartilhadas.`
      : cleanCode
      ? `Convite enviado para ${cleanEmail} (Código: ${cleanCode}). Toque para acompanhar.`
      : `Há ${count} convite(s) pendente(s) no grupo ${cleanGroup}.`;

    return createNotificationModel({
      id: id || `group-invite-${cleanGroup.toLowerCase()}-${count}`,
      type: 'shared_group_invite',
      category: NOTIFICATION_CATEGORIES.SISTEMA,
      title,
      body,
      action: { label: 'Abrir', targetScreen: 'SharedFinances' },
      priority: NOTIFICATION_PRIORITIES.NORMAL,
      createdAt,
      time: time || 'Grupo',
      icon: 'mail-unread-outline',
      color: '#15803D',
      bgColor: '#DCFCE7',
      dedupeKey: `shared_group_invite:${cleanGroup}:${cleanCode || count}:${resolveDateIso(createdAt).slice(0, 10)}`,
      lockScreenTitle: 'Atualização em Finanças Compartilhadas',
      lockScreenBody: 'Há um convite ativo em Finanças Compartilhadas.',
    });
  },

  sharedGroupActivity({
    id,
    groupId,
    groupName = 'Compartilhado',
    title,
    message,
    icon = 'people-outline',
    createdAt,
    time,
  } = {}) {
    const cleanGroup = sanitizeNotificationText(groupName, 'Compartilhado', { stripEmojis: true });
    const safeTitle = sanitizeNotificationText(
      title,
      `Atividade no grupo ${cleanGroup}`,
      { stripEmojis: true }
    );
    const safeBody = sanitizeNotificationText(
      message,
      `Houve uma atualização no grupo ${cleanGroup}. Toque para conferir os detalhes.`
    );

    return createNotificationModel({
      id: id || `group-act-${Date.now()}`,
      type: 'shared_group_activity',
      category: NOTIFICATION_CATEGORIES.SISTEMA,
      title: safeTitle,
      body: safeBody,
      action: { label: 'Abrir', targetScreen: 'SharedFinances' },
      priority: NOTIFICATION_PRIORITIES.NORMAL,
      createdAt,
      time,
      icon,
      color: '#15803D',
      bgColor: '#DCFCE7',
      dedupeKey: `shared_group_activity:${groupId || cleanGroup}:${safeTitle}:${resolveDateIso(createdAt).slice(0, 10)}`,
      lockScreenTitle: `Atualização no grupo ${cleanGroup}`,
      lockScreenBody: 'Uma nova movimentação foi registrada nas Finanças Compartilhadas.',
    });
  },
};

/**
 * Sanitiza e migra qualquer notificação legada já salva no AsyncStorage
 * para garantir que nunca exiba "(undefined)", emojis no título ou "alimentacao" sem acento.
 */
export function normalizeLegacyNotification(rawItem) {
  if (!rawItem || typeof rawItem !== 'object') {
    return NotificationTemplates.systemAppUpdated();
  }

  const rawTitle = String(rawItem.title || '');
  const rawMessage = String(rawItem.message || rawItem.body || '');

  // Corrige notificações antigas de gasto com "💸 Gasto registrado: R$ 20,00" ou "(undefined)"
  if (
    rawTitle.includes('Gasto registrado:') ||
    rawTitle.startsWith('Gasto de ') ||
    rawItem.icon === 'trending-down' ||
    rawItem.icon === 'trending-down-outline'
  ) {
    const amountMatch = rawTitle.match(/R\$\s*([\d.,]+)/i);
    let cleanTitle = sanitizeNotificationText(rawTitle, 'Gasto registrado', { stripEmojis: true });
    if (cleanTitle.toLowerCase().startsWith('gasto registrado:') && amountMatch) {
      cleanTitle = `Gasto de R$ ${amountMatch[1]}`;
    }

    let cleanBody = sanitizeNotificationText(
      rawMessage,
      'Categoria Alimentação. Fique de olho no limite mensal.'
    );
    // Se vinha no formato antigo "Movimentação em alimentacao ()", converte para frase limpa
    const movMatch = cleanBody.match(/^Movimenta[çc][ãa]o em\s+([a-zA-ZÀ-ÿ]+)/i);
    if (movMatch) {
      const catPt = getCategoryLabelPt(movMatch[1], 'Alimentação');
      cleanBody = `Gasto registrado em ${catPt}. Fique de olho no limite mensal.`;
    }

    return createNotificationModel({
      ...rawItem,
      type: rawItem.type || 'transaction_expense',
      category: NOTIFICATION_CATEGORIES.GASTOS,
      title: cleanTitle,
      body: cleanBody,
      action: { label: 'Abrir', targetScreen: 'Transactions' },
      icon: 'trending-down-outline',
      color: '#B91C1C',
      bgColor: '#FEE2E2',
      createdAt: rawItem.createdAt,
      time: rawItem.time,
    });
  }

  if (
    rawTitle.includes('Entrada registrada:') ||
    rawTitle.startsWith('Entrada de ') ||
    rawTitle.startsWith('Receita de ') ||
    rawItem.icon === 'trending-up' ||
    rawItem.icon === 'trending-up-outline'
  ) {
    const amountMatch = rawTitle.match(/R\$\s*([\d.,]+)/i);
    let cleanTitle = sanitizeNotificationText(rawTitle, 'Receita registrada', { stripEmojis: true });
    if (cleanTitle.toLowerCase().startsWith('entrada registrada:') && amountMatch) {
      cleanTitle = `Receita de R$ ${amountMatch[1]}`;
    }

    return createNotificationModel({
      ...rawItem,
      type: rawItem.type || 'transaction_income',
      category: NOTIFICATION_CATEGORIES.GASTOS,
      title: cleanTitle,
      body: sanitizeNotificationText(rawMessage, 'Receita registrada com sucesso na sua conta.'),
      action: { label: 'Abrir', targetScreen: 'Transactions' },
      icon: 'trending-up-outline',
      color: '#15803D',
      bgColor: '#DCFCE7',
      createdAt: rawItem.createdAt,
      time: rawItem.time,
    });
  }

  const normalizedCat = normalizeNotificationCategory(rawItem.category);
  return createNotificationModel({
    ...rawItem,
    type: rawItem.type || 'activity',
    category: normalizedCat,
    title: sanitizeNotificationText(rawTitle, 'Notificação FINN', { stripEmojis: true }),
    body: sanitizeNotificationText(rawMessage, 'Confira os detalhes no aplicativo.'),
    action: rawItem.action || (rawItem.targetScreen ? { label: rawItem.ctaLabel || 'Abrir', targetScreen: rawItem.targetScreen } : null),
    createdAt: rawItem.createdAt,
    time: rawItem.time,
    isHeroAi: Boolean(rawItem.isHeroAi),
    badge: rawItem.badge,
    section: rawItem.section,
  });
}

