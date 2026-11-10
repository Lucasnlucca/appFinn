import test from 'node:test';
import assert from 'node:assert/strict';
import {
  NOTIFICATION_CATEGORIES,
  NOTIFICATION_PRIORITIES,
  NotificationTemplates,
  formatCurrencyBRL,
  getCategoryLabelPt,
  sanitizeNotificationText,
  normalizeLegacyNotification,
} from '../../apps/mobile/src/services/notificationTemplates.js';

const EMOJI_CHECK =
  /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F1E6}-\u{1F1FF}\u{1F600}-\u{1F64F}\u{1F680}-\u{1F6FF}]/u;

function assertValidNotification(notif) {
  assert.ok(notif && typeof notif === 'object', 'Notificação deve ser um objeto');
  assert.ok(typeof notif.id === 'string' && notif.id.length > 0, 'ID deve ser preenchido');
  assert.ok(typeof notif.type === 'string' && notif.type.length > 0, 'Tipo deve ser preenchido');
  assert.ok(
    Object.values(NOTIFICATION_CATEGORIES).includes(notif.category),
    `Categoria inválida: ${notif.category}`
  );
  assert.ok(typeof notif.title === 'string' && notif.title.length > 0, 'Título não pode ser vazio');
  assert.ok(typeof notif.body === 'string' && notif.body.length > 0, 'Corpo não pode ser vazio');

  for (const field of [notif.title, notif.body, notif.lockScreenTitle, notif.lockScreenBody]) {
    assert.ok(!/\bundefined\b/i.test(field), `Campo contém "undefined": "${field}"`);
    assert.ok(!/\bnull\b/i.test(field), `Campo contém "null": "${field}"`);
    assert.ok(!/\(\s*\)/.test(field), `Campo contém parênteses vazios "()": "${field}"`);
  }

  assert.ok(!EMOJI_CHECK.test(notif.title), `Título não deve conter emojis: "${notif.title}"`);
}

test('formatCurrencyBRL formata valores no padrão pt-BR', () => {
  assert.equal(formatCurrencyBRL(20), 'R$ 20,00');
  assert.equal(formatCurrencyBRL(4000), 'R$ 4.000,00');
  assert.equal(formatCurrencyBRL(1234.56), 'R$ 1.234,56');
  assert.equal(formatCurrencyBRL(undefined), 'R$ 0,00');
  assert.equal(formatCurrencyBRL(null), 'R$ 0,00');
});

test('getCategoryLabelPt corrige acentuação e valores indefinidos', () => {
  assert.equal(getCategoryLabelPt('alimentacao'), 'Alimentação');
  assert.equal(getCategoryLabelPt('saude'), 'Saúde');
  assert.equal(getCategoryLabelPt('educacao'), 'Educação');
  assert.equal(getCategoryLabelPt('salario'), 'Salário');
  assert.equal(getCategoryLabelPt(undefined, 'Alimentação'), 'Alimentação');
  assert.equal(getCategoryLabelPt('undefined', 'Outros'), 'Outros');
});

test('Todos os templates geram notificações válidas mesmo sem argumentos ou com undefined/null', () => {
  const templatesToTest = [
    () => NotificationTemplates.transactionRecorded(),
    () =>
      NotificationTemplates.transactionRecorded({
        type: 'expense',
        amount: undefined,
        category: 'alimentacao',
        description: undefined,
      }),
    () =>
      NotificationTemplates.transactionRecorded({
        type: 'income',
        amount: 4000,
        category: 'salario',
        description: null,
      }),
    () => NotificationTemplates.receiptProcessed({ amount: 45.9, category: 'alimentacao', merchant: undefined }),
    () => NotificationTemplates.receiptFailed({ reason: undefined }),
    () => NotificationTemplates.categoryBudgetAlert({ category: 'alimentacao', percentage: 80, spent: 800, limit: 1000 }),
    () => NotificationTemplates.categoryBudgetAlert({ category: 'lazer', percentage: 100, spent: 500, limit: 500 }),
    () => NotificationTemplates.unusualExpenseAlert({ amount: 350, category: 'alimentacao', averageAmount: 110 }),
    () => NotificationTemplates.lowBalanceOrNegativeProjectionAlert({ currentBalance: -50, projectedBalance: -200 }),
    () => NotificationTemplates.billDueAlert({ billTitle: undefined, amount: 150, daysUntilDue: 3 }),
    () => NotificationTemplates.billDueAlert({ billTitle: 'Energia', amount: 150, daysUntilDue: 0 }),
    () => NotificationTemplates.aiSavingsOpportunity({ savedPercent: 100, freeBalance: 4000 }),
    () => NotificationTemplates.aiWeeklySummary({ totalSpent: 320, topCategory: 'alimentacao', savedAmount: 800 }),
    () => NotificationTemplates.aiGoalProgress({ goalTitle: 'Reserva', currentAmount: 4500, targetAmount: 5000, percent: 90 }),
    () => NotificationTemplates.aiGoalProgress({ goalTitle: 'Viagem', currentAmount: 5000, targetAmount: 5000, percent: 100 }),
    () => NotificationTemplates.dailyRegisterReminder(),
    () => NotificationTemplates.reengagementReminder({ daysInactive: 5 }),
    () => NotificationTemplates.systemAppUpdated(),
    () => NotificationTemplates.systemFeatureNews({ title: undefined, body: undefined }),
    () => NotificationTemplates.sharedGroupInvite({ groupName: 'Casal', invitedEmail: undefined, inviteCode: 'ABC123' }),
    () => NotificationTemplates.sharedGroupActivity({ groupName: 'Casal', title: undefined, message: undefined }),
  ];

  for (const factory of templatesToTest) {
    const notif = factory();
    assertValidNotification(notif);
  }
});

test('Template transacional de gasto reproduz texto acentuado sem undefined', () => {
  const notif = NotificationTemplates.transactionRecorded({
    type: 'expense',
    amount: 20,
    category: 'alimentacao',
    description: undefined,
  });
  assertValidNotification(notif);
  assert.equal(notif.title, 'Gasto de R$ 20,00');
  assert.match(notif.body, /Alimentação/);
  assert.equal(notif.lockScreenTitle, 'Novo gasto registrado');
});

test('normalizeLegacyNotification corrige o bug legado "Movimentação em alimentacao (undefined)"', () => {
  const corrupted = {
    id: 'notif-tx-123',
    category: 'economy',
    icon: 'trending-down',
    title: '💸 Gasto registrado: R$ 20,00',
    message: 'Movimentação em alimentacao (undefined). Fique atento ao limite mensal!',
    time: '02:53',
  };

  const fixed = normalizeLegacyNotification(corrupted);
  assertValidNotification(fixed);
  assert.equal(fixed.title, 'Gasto de R$ 20,00');
  assert.match(fixed.body, /Alimentação/);
  assert.ok(!fixed.body.includes('undefined'));
  assert.ok(!fixed.body.includes('alimentacao'));
});

test('Alertas críticos são marcados com prioridade CRITICAL para furar horário de silêncio', () => {
  const billToday = NotificationTemplates.billDueAlert({
    billTitle: 'Aluguel',
    amount: 1800,
    daysUntilDue: 0,
  });
  const negBalance = NotificationTemplates.lowBalanceOrNegativeProjectionAlert({
    currentBalance: -120,
  });

  assert.equal(billToday.priority, NOTIFICATION_PRIORITIES.CRITICAL);
  assert.equal(negBalance.priority, NOTIFICATION_PRIORITIES.CRITICAL);
});

