import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEYS = {
  GEMINI_KEY: '@finn_gemini_api_key',
  GEMINI_MODEL: '@finn_gemini_model',
};

export const DEFAULT_MODEL = 'gemini-2.5-flash';
export const FALLBACK_MODEL = 'gemini-1.5-flash';

/**
 * Recupera ou salva a chave do Gemini no dispositivo
 */
export async function getGeminiApiKey() {
  try {
    return await AsyncStorage.getItem(STORAGE_KEYS.GEMINI_KEY);
  } catch (e) {
    return null;
  }
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
    return saved || DEFAULT_MODEL;
  } catch (e) {
    return DEFAULT_MODEL;
  }
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
 * Chamada principal para a API do Google Gemini
 */
async function callGeminiApi({ apiKey, model, parts, systemInstruction }) {
  const currentKey = apiKey || (await getGeminiApiKey());
  if (!currentKey) {
    throw new Error('CHAVE_GEMINI_AUSENTE');
  }

  const selectedModel = model || (await getGeminiModel());
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${selectedModel}:generateContent?key=${currentKey}`;

  const body = {
    systemInstruction: {
      parts: [
        {
          text: systemInstruction || `Você é o FINN AI, o assistente financeiro pessoal de inteligência artificial de um casal (Henrique e sua esposa).
Você ajuda o casal a controlar despesas, manter as contas em dia, economizar e planejar o futuro financeiro familiar.
Seja sempre simpático, objetivo, preciso com valores em Reais (R$) e focado em praticidade.
Quando o usuário relatar um gasto, enviar comprovante, foto de nota fiscal, PDF ou áudio de despesa/receita, analise e extraia os dados estruturados no formato JSON quando solicitado.`,
        },
      ],
    },
    contents: [
      {
        role: 'user',
        parts,
      },
    ],
    generationConfig: {
      temperature: 0.2,
      maxOutputTokens: 1024,
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
    // Tenta fallback para gemini-1.5-flash caso o modelo 2.5 não esteja liberado na chave
    if (selectedModel !== FALLBACK_MODEL && (response.status === 404 || response.status === 400)) {
      return callGeminiApi({ apiKey, model: FALLBACK_MODEL, parts, systemInstruction });
    }
    throw new Error(`Erro na Gemini API (${response.status}): ${errText}`);
  }

  const data = await response.json();
  const candidate = data.candidates?.[0];
  const responseText = candidate?.content?.parts?.[0]?.text || '';
  return responseText;
}

/**
 * Conversa em texto com o FINN AI
 */
export async function sendTextMessageToGemini({ message, financialContext }) {
  const systemInstruction = `Você é o FINN AI, assistente financeiro do casal Henrique e Esposa.
Contexto Financeiro Atual do Casal:
• Saldo Total em Contas: R$ ${financialContext?.totalBalance?.toFixed(2) || '0,00'}
• Receitas do Mês: R$ ${financialContext?.totalIncome?.toFixed(2) || '0,00'}
• Despesas do Mês: R$ ${financialContext?.totalExpense?.toFixed(2) || '0,00'}
• Membro Ativo Atual: ${financialContext?.activeMember || 'Casal'}

DIRETRIZES:
1. Se a mensagem do usuário indicar um registro financeiro (ex: "gastei 45 no mercado", "recebi 200 de freela", "paguei 90 de luz"), você DEVE responder com uma instrução JSON clara dentro de um bloco \`\`\`json:
\`\`\`json
{
  "action": "TRANSACTION_DETECTED",
  "data": {
    "description": "Nome do estabelecimento ou serviço",
    "amount": 45.00,
    "type": "expense" ou "income",
    "category": "alimentacao" | "moradia" | "transporte" | "saude" | "lazer" | "salario" | "outros"
  },
  "reply": "Texto amigável confirmando o que entendeu"
}
\`\`\`
2. Caso seja uma pergunta comum, pedido de conselho ou consulta sobre as finanças do casal, responda diretamente em texto em tom amigável e encorajador.`;

  return await callGeminiApi({
    parts: [{ text: message }],
    systemInstruction,
  });
}

/**
 * Analisa imagem de Comprovante de Pagamento (PIX, Máquina de Cartão, Recibo)
 */
export async function analyzeReceiptImage({ base64Image, mimeType = 'image/jpeg', financialContext }) {
  const prompt = `Analise atentamente esta imagem de comprovante bancário / recibo de compra / cupom fiscal.
Extraia os seguintes dados financeiros e responda OBRIGATORIAMENTE em JSON válido:

\`\`\`json
{
  "action": "TRANSACTION_DETECTED",
  "data": {
    "description": "Nome da empresa/beneficiário/estabelecimento",
    "amount": 0.00,
    "type": "expense",
    "category": "alimentacao" | "moradia" | "transporte" | "saude" | "lazer" | "outros",
    "date": "YYYY-MM-DD"
  },
  "reply": "Resumo em uma frase do comprovante analisado com valor e favorecido."
}
\`\`\`
Se a imagem não for um comprovante ou não contiver valores legíveis, responda:
\`\`\`json
{
  "action": "INVALID_RECEIPT",
  "reply": "Não consegui identificar um comprovante legível nesta imagem. Por favor, envie uma foto nítida."
}
\`\`\``;

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
 * Analisa documento PDF (Boleto, Nota Fiscal, Extrato)
 */
export async function analyzeInvoicePdf({ base64Pdf, financialContext }) {
  const prompt = `Analise este documento PDF financeiro (boleto, nota fiscal eletrônica ou fatura).
Extraia os dados da fatura/compra e retorne OBRIGATORIAMENTE em JSON:

\`\`\`json
{
  "action": "TRANSACTION_DETECTED",
  "data": {
    "description": "Emissor/Cedente da fatura ou produto principal",
    "amount": 0.00,
    "type": "expense",
    "category": "moradia" | "alimentacao" | "transporte" | "saude" | "lazer" | "outros",
    "date": "YYYY-MM-DD"
  },
  "reply": "Resumo explicativo do boleto ou nota fiscal com valor e vencimento."
}
\`\`\`
Se o PDF não tiver dados financeiros, informe educadamente em JSON.`;

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
export async function analyzeVoiceAudio({ base64Audio, mimeType = 'audio/m4a', financialContext }) {
  const prompt = `Ouça atentamente este áudio gravado por um dos cônjuges (Henrique ou sua esposa).
Transcreva o que foi falado e verifique se há um comando de gasto, receita ou dúvida financeira.
Retorne OBRIGATORIAMENTE em JSON:

\`\`\`json
{
  "transcription": "Texto transcrito com exatidão do que a pessoa falou",
  "action": "TRANSACTION_DETECTED" ou "QUESTION",
  "data": {
    "description": "Nome da despesa ou receita citada",
    "amount": 0.00,
    "type": "expense" ou "income",
    "category": "alimentacao" | "moradia" | "transporte" | "saude" | "lazer" | "salario" | "outros"
  },
  "reply": "Resposta atenciosa do assistente FINN ao que foi falado"
}
\`\`\`
Se a pessoa apenas fez uma pergunta, coloque "action": "QUESTION" e preencha "reply" com a resposta apropriada com base nas finanças do casal.`;

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
