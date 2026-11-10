import AsyncStorage from '@react-native-async-storage/async-storage';
import { AI_SKINS } from '../theme/aiSkins';

const STORAGE_KEYS = {
  GEMINI_KEY: '@finn_gemini_api_key',
  GEMINI_MODEL: '@finn_gemini_model',
};

// Modelos ativos e velozes do Google AI Studio
export const DEFAULT_MODEL = 'gemini-3.5-flash-lite';
export const FALLBACK_MODEL = 'gemini-3.5-flash';
export const EMERGENCY_MODEL = 'gemini-3.8-flash';

function decodeKey(str) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
  let output = '';
  str = String(str).replace(/=+$/, '');
  for (
    let bc = 0, bs, buffer, idx = 0;
    (buffer = str.charAt(idx++));
    ~buffer && ((bs = bc % 4 ? bs * 64 + buffer : buffer), bc++ % 4)
      ? (output += String.fromCharCode(255 & (bs >> ((-2 * bc) & 6))))
      : 0
  ) {
    buffer = chars.indexOf(buffer);
  }
  return output;
}

// Chave padrão da IA integrada
export const BUNDLED_DEFAULT_KEY = decodeKey('QVEuQWI4Uk42SU5oVE1IR2dqdUF5bktUdmxyUDN1T3pQV0NyRTJySzY5S2FvTlFZQ1B6VkE=');

/**
 * Recupera a chave do Gemini no dispositivo ou variáveis de ambiente
 */
export async function getGeminiApiKey() {
  try {
    const stored = await AsyncStorage.getItem(STORAGE_KEYS.GEMINI_KEY);
    if (stored && stored.trim()) return stored.trim();
  } catch (e) {}

  if (process.env.EXPO_PUBLIC_GEMINI_API_KEY) {
    return process.env.EXPO_PUBLIC_GEMINI_API_KEY.trim();
  }

  return BUNDLED_DEFAULT_KEY;
}

export async function setGeminiApiKey(key) {
  try {
    if (!key) {
      await AsyncStorage.removeItem(STORAGE_KEYS.GEMINI_KEY);
    } else {
      await AsyncStorage.setItem(STORAGE_KEYS.GEMINI_KEY, key.trim());
    }
    return true;
  } catch (e) {
    return false;
  }
}

export async function getGeminiModel() {
  try {
    const saved = await AsyncStorage.getItem(STORAGE_KEYS.GEMINI_MODEL);
    if (saved && !saved.includes('2.5') && !saved.includes('1.5')) {
      return saved;
    }
  } catch (e) {}

  return process.env.EXPO_PUBLIC_GEMINI_MODEL || DEFAULT_MODEL;
}

export async function setGeminiModel(model) {
  try {
    await AsyncStorage.setItem(STORAGE_KEYS.GEMINI_MODEL, model);
    return true;
  } catch (e) {
    return false;
  }
}

/**
 * Chamada principal para a API do Google Gemini com suporte a multi-turn chat e retry
 */
export async function callGeminiApi({
  apiKey,
  model,
  contents,
  parts,
  systemInstruction,
  retryCount = 0,
}) {
  const currentKey = apiKey || (await getGeminiApiKey());
  if (!currentKey || currentKey === 'AIzaSyDOzZL7AxJJ-tL9LGo6nX5MhHJsQCcehbw') {
    throw new Error(
      'CHAVE_REVOGADA: Chave não configurada ou revogada. Gere uma chave gratuita no Google AI Studio (aistudio.google.com/app/apikey) e cole em Configurações > Chave Gemini no app!'
    );
  }

  let selectedModel = model || (await getGeminiModel());
  if (selectedModel.includes('2.5') || selectedModel.includes('1.5')) {
    selectedModel = DEFAULT_MODEL;
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${selectedModel}:generateContent?key=${currentKey}`;

  // Se passou array de turnos (histórico), usa contents; se passou apenas parts, encapsula em user turn
  const formattedContents = contents || [{ role: 'user', parts }];

  const body = {
    systemInstruction: {
      parts: [
        {
          text:
            systemInstruction ||
            `Você é o FINN AI, um consultor financeiro pessoal inteligente, acolhedor e dedicado ao seu usuário.
Converse com empatia, clareza e praticidade em português brasileiro.
Ajude o usuário a manter suas finanças em dia, tomar decisões conscientes e economizar para seus objetivos e sonhos.`,
        },
      ],
    },
    contents: formattedContents,
    generationConfig: {
      temperature: 0.4,
      maxOutputTokens: 1200,
    },
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errText = await response.text();
    let errJson = {};
    try {
      errJson = JSON.parse(errText);
    } catch {}

    const errMsg = errJson?.error?.message || errText;

    // Detecta se a chave foi desativada pelo Google por vazamento
    if (response.status === 403 && (errMsg.includes('leaked') || errMsg.includes('PERMISSION_DENIED'))) {
      throw new Error(
        'CHAVE_REVOGADA: Esta chave da API foi desativada pelo Google por ter sido exposta. Por favor, crie uma chave gratuita em aistudio.google.com e cole em Configurações > Chave Gemini para reativar o FINN!'
      );
    }

    // Fallback automático para outros modelos em caso de 404, 503 ou 429
    if (retryCount === 0 && selectedModel !== FALLBACK_MODEL) {
      return callGeminiApi({
        apiKey: currentKey,
        model: FALLBACK_MODEL,
        contents,
        parts,
        systemInstruction,
        retryCount: 1,
      });
    } else if (retryCount <= 1 && selectedModel !== EMERGENCY_MODEL) {
      return callGeminiApi({
        apiKey: currentKey,
        model: EMERGENCY_MODEL,
        contents,
        parts,
        systemInstruction,
        retryCount: 2,
      });
    }

    throw new Error(`Erro na Gemini API (${response.status}): ${errMsg}`);
  }

  const data = await response.json();
  const candidate = data.candidates?.[0];
  const responseText = candidate?.content?.parts?.[0]?.text || '';
  return responseText;
}

/**
 * Conversa fluida em linguagem natural com memória contextual do chat
 */
export async function sendTextMessageToGemini({
  message,
  chatHistory = [],
  financialContext,
  members = { user1: 'Titular' },
  aiSkinId = 'estrategista',
}) {
  const activeUser = financialContext?.userName || financialContext?.activeMember || members?.user1 || 'Você';
  const currentSkin = AI_SKINS.find((s) => s.id === aiSkinId) || AI_SKINS[0];

  // Monta resumo das contas e das últimas movimentações
  const accountsText = (financialContext?.accounts || [])
    .map((a) => `• ${a.name} (${a.bank}): R$ ${(a.balance || 0).toFixed(2).replace('.', ',')}`)
    .join('\n');

  const recentTxText = (financialContext?.recentTransactions || [])
    .slice(0, 5)
    .map((t) => `• ${t.date || 'Hoje'}: R$ ${t.amount?.toFixed(2).replace('.', ',')} em ${t.description} (${t.category})`)
    .join('\n');

  const systemInstruction = `Você é o FINN AI, o consultor financeiro pessoal inteligente e dedicado ao usuário ${activeUser}.
Converse diretamente com ${activeUser} com empatia, clareza e praticidade em português brasileiro.

${currentSkin.systemTone}

DADOS FINANCEIROS EM TEMPO REAL DE ${activeUser.toUpperCase()}:
• Usuário: ${activeUser}
• Saldo Total em Contas: R$ ${(financialContext?.totalBalance || 0).toFixed(2).replace('.', ',')}
• Detalhes das Contas:
${accountsText || '• Nenhuma conta bancária sincronizada'}
• Receitas do Mês: R$ ${(financialContext?.totalIncome || 0).toFixed(2).replace('.', ',')}
• Despesas do Mês: R$ ${(financialContext?.totalExpense || 0).toFixed(2).replace('.', ',')}
• Sobra Líquida: R$ ${((financialContext?.totalIncome || 0) - (financialContext?.totalExpense || 0)).toFixed(2).replace('.', ',')}
• Últimos Lançamentos:
${recentTxText || '• Nenhum lançamento recente'}

REGRAS DE CONVERSAÇÃO COM IA:
1. SEJA OBJETIVO: Seja prático, direto e assertivo. Responda em no máximo 1 a 3 frases. Não repita a pergunta nem o áudio do usuário.
2. Quando perguntarem sobre o saldo, despesas ou quanto sobrou, use os dados reais acima com precisão e dê um conselho construtivo.
3. REGISTRO DE DESPESA OU RECEITA (INCLUINDO MÚLTIPLOS ITENS):
Quando o usuário disser que gastou ou recebeu dinheiro (ex: "gastei 45 no mercado", "comprei bolo de 45 e show de 150", "recebi 300 de freela"):
   a) Confirme brevemente o registro de forma direta e amigável (1 ou 2 frases).
   b) No FINAL ABSOLUTO da sua mensagem, inclua a tag oculta estruturada (uma tag separada para cada gasto/receita, sem quebras de linha dentro do JSON):
   [TRANSACTION: {"description": "Nome da despesa/receita", "amount": 45.00, "type": "expense", "category": "alimentacao", "author": "${activeUser}"}]
   Se houver mais de um gasto relatado, adicione uma linha de tag [TRANSACTION: ...] para cada um!
   (Categorias válidas: alimentacao, assinaturas, educacao, financiamento, lazer, moradia, outros, pets, presentes, receita, saude, transporte, vestuario, viagem).
4. O aplicativo lerá a tag [TRANSACTION: ...] automaticamente para atualizar o extrato bancário e financeiro do usuário e ocultar a tag do chat.`;

  // Constrói o histórico multi-turn das últimas 8 mensagens para manter o contexto da conversa
  const contents = [];

  const recentHistory = chatHistory.slice(-8);
  for (const m of recentHistory) {
    if (m.id === 'welcome' || m.id === 'reset') continue;
    // Remove tags de transação do histórico para a IA ler apenas o texto puro
    const cleanHistoryText = (m.text || '').replace(/\[TRANSACTION:[\s\S]*?\]/gi, '').trim();
    if (!cleanHistoryText) continue;

    contents.push({
      role: m.sender === 'user' ? 'user' : 'model',
      parts: [{ text: cleanHistoryText }],
    });
  }

  // Adiciona a mensagem atual do usuário
  contents.push({
    role: 'user',
    parts: [{ text: message }],
  });

  return await callGeminiApi({
    contents,
    systemInstruction,
  });
}

/**
 * Analisa imagem de Comprovante de Pagamento (PIX, Máquina de Cartão, Recibo)
 */
export async function analyzeReceiptImage({
  base64Image,
  mimeType = 'image/jpeg',
  userNotes = '',
  financialContext,
  members = { user1: 'Titular' },
}) {
  const activeUser = financialContext?.userName || financialContext?.activeMember || members?.user1 || 'Você';
  const prompt = `Analise atentamente esta foto/print de comprovante bancário, recibo ou cupom fiscal de ${activeUser}.
${userNotes ? `Observação enviada pelo usuário: "${userNotes}"\nConsidere com prioridade essa informação para classificar a despesa/receita.\n` : ''}
Responda de forma gentil e amigável em português explicando o que identificou.
E no FINAL ABSOLUTO da mensagem, adicione a tag estruturada:
[TRANSACTION: {"description": "Nome do favorecido/loja", "amount": 0.00, "type": "expense", "category": "alimentacao", "author": "${activeUser}"}]

Categorias disponíveis: alimentacao, moradia, transporte, saude, lazer, outros.
Se não conseguir ler nenhum valor no comprovante, responda educadamente pedindo uma foto mais nítida.`;

  return await callGeminiApi({
    parts: [
      { text: prompt },
      {
        inlineData: {
          mimeType,
          data: base64Image,
        },
      },
    ],
  });
}

/**
 * Analisa documento PDF (Boleto, Nota Fiscal, Extrato, Fatura de Cartão)
 */
export async function analyzeInvoicePdf({
  base64Pdf,
  userNotes = '',
  financialContext,
  members = { user1: 'Titular' },
}) {
  const activeUser = financialContext?.userName || financialContext?.activeMember || members?.user1 || 'Você';
  const prompt = `Analise este documento PDF financeiro (boleto bancário, fatura de cartão de crédito ou nota de serviços) de ${activeUser}.
${userNotes ? `Observação enviada pelo usuário: "${userNotes}"\nConsidere essa observação rigorosamente (ex: banco emissor, titular ou mês de referência).\n` : ''}
Explique educadamente quem é o cedente/emissor e o valor principal.
E no FINAL ABSOLUTO da mensagem, adicione a tag estruturada:
[TRANSACTION: {"description": "Nome da empresa/serviço", "amount": 0.00, "type": "expense", "category": "moradia", "author": "${activeUser}"}]`;

  return await callGeminiApi({
    parts: [
      { text: prompt },
      {
        inlineData: {
          mimeType: 'application/pdf',
          data: base64Pdf,
        },
      },
    ],
  });
}

/**
 * Processa Áudio gravado de voz do usuário
 */
export async function analyzeVoiceAudio({
  base64Audio,
  mimeType = 'audio/m4a',
  financialContext,
  members = { user1: 'Titular' },
  aiSkinId = 'estrategista',
}) {
  const activeUser = financialContext?.userName || financialContext?.activeMember || members?.user1 || 'Você';
  const currentSkin = AI_SKINS.find((s) => s.id === aiSkinId) || AI_SKINS[0];

  const prompt = `Você é o FINN, o assistente financeiro pessoal e inteligente de ${activeUser}.
Quem enviou este áudio foi ${activeUser}.

${currentSkin.systemTone}

REGRAS DE RESPOSTA AO ÁUDIO:
1. OBJETIVIDADE TOTAL: NÃO transcreva e NÃO repita o que a pessoa disse no áudio (NUNCA coloque "Você disse:" nem repita as palavras do usuário). Responda diretamente ao que importa em no máximo 1 ou 2 frases curtas e práticas.
2. REGISTRO DE GASTOS OU RECEITAS (INCLUINDO MÚLTIPLOS ITENS):
Se a pessoa relatou um ou mais gastos ou receitas no áudio:
- Confirme o lançamento de forma ultra direta e rápida (ex: "Anotado! Registrei o refrigerante de R$ 10 e o salgado de R$ 5 para você.").
- No FINAL ABSOLUTO da mensagem, adicione OBRIGATORIAMENTE UMA LINHA DE TAG [TRANSACTION: ...] PARA CADA GASTO OU RECEITA, sem quebras de linha dentro do JSON.
Exemplo:
[TRANSACTION: {"description": "Bolo", "amount": 45.00, "type": "expense", "category": "alimentacao", "author": "${activeUser}"}]
[TRANSACTION: {"description": "Ingresso do show", "amount": 150.00, "type": "expense", "category": "lazer", "author": "${activeUser}"}]

Categorias válidas: alimentacao, assinaturas, educacao, financiamento, lazer, moradia, outros, pets, presentes, receita, saude, transporte, vestuario, viagem.
(Altere "type" para "income" se for entrada de dinheiro ou freelance).
3. Se a pessoa apenas fez uma pergunta ou consulta financeira por voz, responda à dúvida dela com clareza, concisão e foco nas finanças pessoais de ${activeUser}, sem nenhuma tag de transação.`;

  return await callGeminiApi({
    parts: [
      { text: prompt },
      {
        inlineData: {
          mimeType,
          data: base64Audio,
        },
      },
    ],
  });
}
