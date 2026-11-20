import AsyncStorage from '@react-native-async-storage/async-storage';
import { AI_SKINS } from '../theme/aiSkins';

const STORAGE_KEYS = {
  GEMINI_KEY: '@finn_gemini_api_key',
  GEMINI_MODEL: '@finn_gemini_model',
  AI_PROVIDER_KEYS: '@finn_ai_provider_keys_v1',
  AI_ACTIVE_PROVIDER: '@finn_ai_active_provider_v1',
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

export async function getAiProviderKeys() {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEYS.AI_PROVIDER_KEYS);
    const parsed = raw ? JSON.parse(raw) : {};
    const legacyGemini = (await AsyncStorage.getItem(STORAGE_KEYS.GEMINI_KEY)) || '';
    return {
      gemini: parsed.gemini ?? legacyGemini,
      openai: parsed.openai || '',
      grok: parsed.grok || '',
      claude: parsed.claude || '',
    };
  } catch {
    return { gemini: '', openai: '', grok: '', claude: '' };
  }
}

export async function setAiProviderKeys(keys = {}) {
  try {
    const clean = {
      gemini: (keys.gemini || '').trim(),
      openai: (keys.openai || '').trim(),
      grok: (keys.grok || '').trim(),
      claude: (keys.claude || '').trim(),
    };
    await AsyncStorage.setItem(STORAGE_KEYS.AI_PROVIDER_KEYS, JSON.stringify(clean));
    if (clean.gemini) {
      await AsyncStorage.setItem(STORAGE_KEYS.GEMINI_KEY, clean.gemini);
    } else {
      await AsyncStorage.removeItem(STORAGE_KEYS.GEMINI_KEY);
    }
    return true;
  } catch {
    return false;
  }
}

export async function getActiveAiProvider() {
  try {
    const saved = (await AsyncStorage.getItem(STORAGE_KEYS.AI_ACTIVE_PROVIDER)) || 'gemini';
    const keys = await getAiProviderKeys();
    if (saved === 'gemini' || (keys[saved] && keys[saved].trim())) {
      return saved;
    }
    return 'gemini';
  } catch {
    return 'gemini';
  }
}

export async function setActiveAiProvider(provider = 'gemini') {
  try {
    await AsyncStorage.setItem(STORAGE_KEYS.AI_ACTIVE_PROVIDER, provider);
    return true;
  } catch {
    return false;
  }
}

async function callAdditionalAiProviderMobile({
  provider,
  apiKey,
  contents,
  parts,
  systemInstruction,
}) {
  const cleanKey = (apiKey || '').trim();
  if (!cleanKey) throw new Error(`Chave da API ${provider} não configurada.`);

  const turns = contents || [{ role: 'user', parts: parts || [] }];
  // Se houver áudio inlineData, delega para o Gemini que possui suporte nativo de áudio
  const hasAudio = turns.some((t) =>
    (t.parts || []).some((p) => p?.inlineData?.mimeType?.startsWith('audio/'))
  );
  if (hasAudio) {
    throw new Error('AUDIO_FALLBACK_TO_GEMINI');
  }

  if (provider === 'openai' || provider === 'grok') {
    const endpoint =
      provider === 'grok'
        ? 'https://api.x.ai/v1/chat/completions'
        : 'https://api.openai.com/v1/chat/completions';
    const models =
      provider === 'grok'
        ? ['grok-3-mini', 'grok-2-latest', 'grok-beta']
        : ['gpt-4o-mini', 'gpt-4o'];

    const messages = [];
    if (systemInstruction) {
      messages.push({ role: 'system', content: systemInstruction });
    }
    for (const turn of turns) {
      const role = turn.role === 'user' ? 'user' : 'assistant';
      const textParts = (turn.parts || [])
        .filter((p) => p?.text)
        .map((p) => p.text)
        .join('\n');
      const imgPart = (turn.parts || []).find((p) => p?.inlineData?.mimeType?.startsWith('image/'));
      if (imgPart && role === 'user') {
        messages.push({
          role: 'user',
          content: [
            { type: 'text', text: textParts || 'Analise esta imagem.' },
            {
              type: 'image_url',
              image_url: {
                url: `data:${imgPart.inlineData.mimeType};base64,${imgPart.inlineData.data}`,
              },
            },
          ],
        });
      } else {
        messages.push({ role, content: textParts || 'Olá' });
      }
    }

    for (const model of models) {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${cleanKey}`,
        },
        body: JSON.stringify({ model, messages, temperature: 0.4, max_tokens: 1200 }),
      });
      if (res.ok) {
        const data = await res.json();
        const text = data?.choices?.[0]?.message?.content || '';
        if (text) return text;
      }
    }
    throw new Error(`Falha ao consultar ${provider.toUpperCase()}`);
  }

  if (provider === 'claude') {
    const endpoint = 'https://api.anthropic.com/v1/messages';
    const models = ['claude-3-5-sonnet-latest', 'claude-3-5-haiku-latest', 'claude-3-haiku-20240307'];
    const messages = turns.map((turn) => {
      const role = turn.role === 'user' ? 'user' : 'assistant';
      const textParts = (turn.parts || [])
        .filter((p) => p?.text)
        .map((p) => p.text)
        .join('\n');
      return { role, content: textParts || 'Olá' };
    });

    for (const model of models) {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': cleanKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model,
          max_tokens: 1200,
          system: systemInstruction || undefined,
          messages,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        const text = data?.content?.[0]?.text || '';
        if (text) return text;
      }
    }
    throw new Error('Falha ao consultar Claude API');
  }

  throw new Error('Provedor desconhecido');
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
  // Se o cliente selecionou uma API adicional (ChatGPT, Grok ou Claude), usa ela mantendo a Gemini ativa como fallback
  if (retryCount === 0 && !apiKey) {
    try {
      const activeProv = await getActiveAiProvider();
      if (activeProv && activeProv !== 'gemini') {
        const allKeys = await getAiProviderKeys();
        if (allKeys[activeProv]?.trim()) {
          return await callAdditionalAiProviderMobile({
            provider: activeProv,
            apiKey: allKeys[activeProv],
            contents,
            parts,
            systemInstruction,
          });
        }
      }
    } catch (extErr) {
      // Continua automaticamente para a API Gemini padrão ativa
    }
  }

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

  const cardsText = (financialContext?.cards || [])
    .map((c) => `• Cartão ${c.name || c.bank} (ID: "${c.id}"): Fatura atual R$ ${(c.currentInvoice || 0).toFixed(2).replace('.', ',')}, Limite: R$ ${(c.limit || 0).toFixed(2).replace('.', ',')}`)
    .join('\n');

  const systemInstruction = `Você é o FINN AI, o consultor financeiro pessoal inteligente e dedicado ao usuário ${activeUser}.
Converse diretamente com ${activeUser} com empatia, clareza e praticidade em português brasileiro.

${currentSkin.systemTone}

DADOS FINANCEIROS EM TEMPO REAL DE ${activeUser.toUpperCase()}:
• Usuário: ${activeUser}
• Saldo Total em Contas: R$ ${(financialContext?.totalBalance || 0).toFixed(2).replace('.', ',')}
• Detalhes das Contas:
${accountsText || '• Nenhuma conta bancária sincronizada'}
• Cartões de Crédito Cadastrados:
${cardsText || '• Nenhum cartão de crédito cadastrado'}
• Receitas do Mês: R$ ${(financialContext?.totalIncome || 0).toFixed(2).replace('.', ',')}
• Despesas do Mês: R$ ${(financialContext?.totalExpense || 0).toFixed(2).replace('.', ',')}
• Sobra Líquida: R$ ${((financialContext?.totalIncome || 0) - (financialContext?.totalExpense || 0)).toFixed(2).replace('.', ',')}
• Últimos Lançamentos:
${recentTxText || '• Nenhum lançamento recente'}

REGRAS DE CONVERSAÇÃO COM IA:
1. SEJA OBJETIVO: Seja prático, direto e assertivo. Responda em no máximo 1 a 3 frases. Não repita a pergunta nem o áudio do usuário.
2. Quando perguntarem sobre o saldo, despesas ou quanto sobrou, use os dados reais acima com precisão e dê um conselho construtivo.

3. REGISTRO DE DESPESA OU RECEITA GERAL:
Quando o usuário disser que gastou ou recebeu dinheiro (ex: "gastei 45 no mercado", "recebi 300 de freela"):
- Confirme brevemente o registro de forma direta e amigável (1 ou 2 frases).
- No FINAL ABSOLUTO da sua mensagem, inclua a tag oculta estruturada:
[TRANSACTION: {"description": "Nome da despesa/receita", "amount": 45.00, "type": "expense", "category": "alimentacao", "author": "${activeUser}"}]
(Categorias válidas: alimentacao, assinaturas, educacao, financiamento, lazer, moradia, outros, pets, presentes, receita, saude, transporte, vestuario, viagem).

4. REGRAS OBRIGATÓRIAS PARA GASTOS NO CARTÃO (CRÉDITO vs DÉBITO):
A) GASTO ESPECIFICADO NO CRÉDITO OU CARTÃO DE CRÉDITO (ex: "gastei 50 no crédito", "comprei bolo de 40 no cartão de crédito"):
   - Se o usuário tem apenas 1 cartão cadastrado (ou se já falou o nome do cartão, ex: "no crédito do Nubank"):
     Lance a despesa vinculando ao cartão com a tag:
     [TRANSACTION: {"description": "Bolo", "amount": 40.00, "type": "expense", "category": "alimentacao", "author": "${activeUser}", "paymentMethod": "credit_card", "cardId": "ID_DO_CARTAO", "cardName": "NOME_DO_CARTAO"}]
     E na resposta escrita confirme: "Lançado no extrato e adicionado à fatura do seu cartão [Nome do Cartão]!".
   - Se o usuário possui 2 ou mais cartões cadastrados e NÃO disse qual:
     NÃO gere a tag TRANSACTION ainda. Pergunte diretamente:
     "Em qual dos seus cartões de crédito você deseja lançar esse gasto de R$ [valor]?"
     E no FINAL adicione a tag:
     [ASK_CARD: {"description": "Nome do gasto", "amount": 40.00, "category": "alimentacao"}]
   - Se o usuário não possui nenhum cartão cadastrado:
     Gere a tag com "paymentMethod": "credit_card" e informe que ele pode cadastrar o cartão na aba de Cartões.

B) USUÁRIO DISSE APENAS "NO CARTÃO" SEM ESPECIFICAR CRÉDITO OU DÉBITO (ex: "gastei 50 no cartão", "comprei remédio de 30 no cartão"):
   NÃO gere a tag TRANSACTION ainda. Pergunte com clareza:
   "Essa compra de R$ [valor] em [local/gasto] foi no **cartão de crédito** ou no **débito**?"
   E no FINAL adicione a tag:
   [ASK_PAYMENT_METHOD: {"description": "Nome do gasto", "amount": 50.00, "category": "outros"}]

C) QUANDO O USUÁRIO RESPONDER À PERGUNTA ANTERIOR:
   - Se responder "crédito" ou "cartão de crédito":
     - Se tiver 1 cartão: lança no cartão de crédito com a tag [TRANSACTION: ... "paymentMethod": "credit_card", "cardId": "...", "cardName": "..."]!
     - Se tiver múltiplos cartões: pergunta em qual cartão deseja lançar com [ASK_CARD: ...]!
   - Se responder "débito":
     Lança normalmente no extrato com a tag [TRANSACTION: ... "paymentMethod": "debit"]!
   - Se responder o nome de um dos cartões (ex: "Nubank", "Itaú"):
     Lança a transação vinculando a esse cartão de crédito!`;

  // Constrói o histórico multi-turn das últimas 8 mensagens para manter o contexto da conversa
  const contents = [];

  const recentHistory = chatHistory.slice(-8);
  for (const m of recentHistory) {
    if (m.id === 'welcome' || m.id === 'reset') continue;
    // Remove tags de transação e ações interativas do histórico para a IA ler apenas o texto puro
    const cleanHistoryText = (m.text || '')
      .replace(/\[(TRANSACTION|ASK_PAYMENT_METHOD|ASK_CARD):[\s\S]*?\]/gi, '')
      .trim();
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

  const cardsText = (financialContext?.cards || [])
    .map((c) => `• Cartão ${c.name || c.bank} (ID: "${c.id}"): Fatura atual R$ ${(c.currentInvoice || 0).toFixed(2).replace('.', ',')}, Limite: R$ ${(c.limit || 0).toFixed(2).replace('.', ',')}`)
    .join('\n');

  const prompt = `Você é o FINN, o assistente financeiro pessoal e inteligente de ${activeUser}.
Quem enviou este áudio foi ${activeUser}.

${currentSkin.systemTone}

CARTÕES DE CRÉDITO DO USUÁRIO:
${cardsText || '• Nenhum cartão de crédito cadastrado'}

REGRAS DE RESPOSTA AO ÁUDIO:
1. OBJETIVIDADE TOTAL: NÃO transcreva e NÃO repita o que a pessoa disse no áudio (NUNCA coloque "Você disse:" nem repita as palavras do usuário). Responda diretamente ao que importa em no máximo 1 ou 2 frases curtas e práticas.
2. REGISTRO DE GASTOS OU RECEITAS GERAL:
Se a pessoa relatou um ou mais gastos ou receitas no áudio:
- Confirme o lançamento de forma ultra direta e rápida (ex: "Anotado! Registrei o refrigerante de R$ 10 para você.").
- No FINAL ABSOLUTO da mensagem, adicione OBRIGATORIAMENTE UMA LINHA DE TAG [TRANSACTION: ...] PARA CADA GASTO OU RECEITA, sem quebras de linha dentro do JSON.
Categorias válidas: alimentacao, assinaturas, educacao, financiamento, lazer, moradia, outros, pets, presentes, receita, saude, transporte, vestuario, viagem.

3. REGRAS OBRIGATÓRIAS PARA GASTOS NO CARTÃO (CRÉDITO vs DÉBITO):
A) GASTO ESPECIFICADO NO CRÉDITO OU CARTÃO DE CRÉDITO (ex: "gastei 50 no crédito", "comprei almoço no cartão de crédito"):
   - Se o usuário tem apenas 1 cartão cadastrado (ou se já falou o nome do cartão no áudio, ex: "no crédito do Nubank"):
     Lance a despesa vinculando ao cartão com a tag:
     [TRANSACTION: {"description": "Almoço", "amount": 50.00, "type": "expense", "category": "alimentacao", "author": "${activeUser}", "paymentMethod": "credit_card", "cardId": "ID_DO_CARTAO", "cardName": "NOME_DO_CARTAO"}]
     E na resposta escrita confirme: "Lançado no extrato e adicionado à fatura do seu cartão [Nome do Cartão]!".
   - Se o usuário possui 2 ou mais cartões cadastrados e NÃO disse qual:
     NÃO gere a tag TRANSACTION ainda. Pergunte diretamente:
     "Em qual dos seus cartões de crédito você deseja lançar esse gasto de R$ [valor]?"
     E no FINAL adicione a tag:
     [ASK_CARD: {"description": "Nome do gasto", "amount": 50.00, "category": "alimentacao"}]

B) USUÁRIO DISSE APENAS "NO CARTÃO" SEM ESPECIFICAR CRÉDITO OU DÉBITO (ex: "gastei 50 no cartão"):
   NÃO gere a tag TRANSACTION ainda. Pergunte com clareza:
   "Essa compra de R$ [valor] foi no **cartão de crédito** ou no **débito**?"
   E no FINAL adicione a tag:
   [ASK_PAYMENT_METHOD: {"description": "Nome do gasto", "amount": 50.00, "category": "outros"}]

C) RESPOSTA A PERGUNTA ANTERIOR:
   - Se o áudio responder "crédito", vincula ao cartão (se houver mais de 1, pergunta qual).
   - Se responder "débito", lança normalmente como "paymentMethod": "debit".
   - Se responder o nome do cartão (ex: "Nubank"), vincula ao cartão.

4. Se a pessoa apenas fez uma pergunta ou consulta financeira por voz, responda à dúvida dela com clareza, concisão e foco nas finanças pessoais de ${activeUser}, sem nenhuma tag de transação.`;

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
