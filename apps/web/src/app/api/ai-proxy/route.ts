import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface ProxyRequestBody {
  provider: 'gemini' | 'openai' | 'grok' | 'claude';
  apiKey: string;
  systemInstruction?: string;
  messages: Array<{ role: 'user' | 'assistant' | 'model'; text: string }>;
  attachment?: {
    type: 'pdf' | 'csv' | 'image' | 'audio';
    name: string;
    mimeType: string;
    base64?: string;
    textContent?: string;
  } | null;
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as ProxyRequestBody;
    const { provider, apiKey, systemInstruction, messages = [], attachment } = body;

    if (!apiKey || !apiKey.trim()) {
      return NextResponse.json(
        { error: `Chave de API não informada para o provedor ${provider.toUpperCase()}.` },
        { status: 400 },
      );
    }

    const cleanKey = apiKey.trim();

    // 1. OPENAI (ChatGPT) ou XAI (Grok) - Compatíveis com formato OpenAI Chat Completions
    if (provider === 'openai' || provider === 'grok') {
      const endpoint =
        provider === 'grok'
          ? 'https://api.x.ai/v1/chat/completions'
          : 'https://api.openai.com/v1/chat/completions';

      const models =
        provider === 'grok'
          ? ['grok-3-mini', 'grok-2-latest', 'grok-beta']
          : ['gpt-4o-mini', 'gpt-4o'];

      const openAiMessages: any[] = [];
      if (systemInstruction) {
        openAiMessages.push({ role: 'system', content: systemInstruction });
      }

      for (let i = 0; i < messages.length; i++) {
        const m = messages[i];
        const isLastUser = i === messages.length - 1 && m.role === 'user';

        if (isLastUser && attachment?.type === 'image' && attachment.base64) {
          openAiMessages.push({
            role: 'user',
            content: [
              { type: 'text', text: m.text || 'Analise este comprovante financeiro.' },
              {
                type: 'image_url',
                image_url: {
                  url: `data:${attachment.mimeType || 'image/jpeg'};base64,${attachment.base64}`,
                },
              },
            ],
          });
        } else {
          openAiMessages.push({
            role: m.role === 'user' ? 'user' : 'assistant',
            content: m.text,
          });
        }
      }

      let lastErr = '';
      for (const model of models) {
        const res = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${cleanKey}`,
          },
          body: JSON.stringify({
            model,
            messages: openAiMessages,
            temperature: 0.4,
            max_tokens: 1200,
          }),
        });

        if (res.ok) {
          const data = await res.json();
          const text = data?.choices?.[0]?.message?.content || '';
          if (text) {
            return NextResponse.json({ text, provider, model });
          }
        } else {
          const errData = await res.json().catch(() => null);
          lastErr = errData?.error?.message || `HTTP ${res.status}`;
        }
      }

      return NextResponse.json(
        { error: `Erro na API ${provider.toUpperCase()}: ${lastErr}` },
        { status: 502 },
      );
    }

    // 2. ANTHROPIC (Claude)
    if (provider === 'claude') {
      const endpoint = 'https://api.anthropic.com/v1/messages';
      const models = ['claude-3-5-sonnet-latest', 'claude-3-5-haiku-latest', 'claude-3-haiku-20240307'];

      const claudeMessages: any[] = [];
      for (let i = 0; i < messages.length; i++) {
        const m = messages[i];
        const role = m.role === 'user' ? 'user' : 'assistant';
        const isLastUser = i === messages.length - 1 && role === 'user';

        if (isLastUser && attachment?.type === 'image' && attachment.base64) {
          claudeMessages.push({
            role: 'user',
            content: [
              {
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: attachment.mimeType || 'image/jpeg',
                  data: attachment.base64,
                },
              },
              { type: 'text', text: m.text || 'Analise este comprovante financeiro.' },
            ],
          });
        } else if (isLastUser && attachment?.type === 'pdf' && attachment.base64) {
          claudeMessages.push({
            role: 'user',
            content: [
              {
                type: 'document',
                source: {
                  type: 'base64',
                  media_type: 'application/pdf',
                  data: attachment.base64,
                },
              },
              { type: 'text', text: m.text || 'Analise este PDF financeiro.' },
            ],
          });
        } else {
          claudeMessages.push({
            role,
            content: m.text || 'Olá',
          });
        }
      }

      let lastErr = '';
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
            messages: claudeMessages,
          }),
        });

        if (res.ok) {
          const data = await res.json();
          const text = data?.content?.[0]?.text || '';
          if (text) {
            return NextResponse.json({ text, provider, model });
          }
        } else {
          const errData = await res.json().catch(() => null);
          lastErr = errData?.error?.message || `HTTP ${res.status}`;
        }
      }

      return NextResponse.json(
        { error: `Erro na API Claude: ${lastErr}` },
        { status: 502 },
      );
    }

    return NextResponse.json({ error: 'Provedor inválido.' }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || 'Falha interna ao consultar provedor de IA.' },
      { status: 500 },
    );
  }
}
