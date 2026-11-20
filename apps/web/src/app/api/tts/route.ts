import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function decodeBundledKey(str: string): string {
  try {
    return Buffer.from(str, 'base64').toString('utf-8');
  } catch {
    return '';
  }
}

const BUNDLED_GEMINI_KEY = decodeBundledKey(
  'QVEuQWI4Uk42SU5oVE1IR2dqdUF5bktUdmxyUDN1T3pQV0NyRTJySzY5S2FvTlFZQ1B6VkE=',
);

/**
 * Limpa markdown e emojis para que a voz neural leia com fluidez natural em português
 */
function prepareTextForNeuralSpeech(raw: string): string {
  return String(raw || '')
    .replace(/\[(TRANSACTION|ASK_PAYMENT_METHOD|ASK_CARD):[\s\S]*?\]/gi, '')
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/\*(.*?)\*/g, '$1')
    .replace(/`(.*?)`/g, '$1')
    .replace(/^[•\-]\s*/gm, '')
    .replace(/[🍔🎬📚🏷️🎮🏠📦🐾🎁💰💊🚕🚗👕✈️🎯✨⚡📌•#—]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 1800);
}

/**
 * Converte buffer PCM 16-bit mono (24000 Hz) retornado pelo Gemini TTS em um arquivo WAV válido
 */
function pcm16ToWavBuffer(pcmBuffer: Buffer, sampleRate = 24000): Buffer {
  const numChannels = 1;
  const bitsPerSample = 16;
  const byteRate = (sampleRate * numChannels * bitsPerSample) / 8;
  const blockAlign = (numChannels * bitsPerSample) / 8;
  const dataSize = pcmBuffer.length;
  const header = Buffer.alloc(44);

  header.write('RIFF', 0);
  header.writeUInt32LE(36 + dataSize, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16); // Subchunk1Size (16 for PCM)
  header.writeUInt16LE(1, 20); // AudioFormat (1 = PCM)
  header.writeUInt16LE(numChannels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bitsPerSample, 34);
  header.write('data', 36);
  header.writeUInt32LE(dataSize, 40);

  return Buffer.concat([header, pcmBuffer]);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const cleanText = prepareTextForNeuralSpeech(body?.text || '');
    if (!cleanText) {
      return NextResponse.json({ error: 'Texto vazio para síntese de voz.' }, { status: 400 });
    }

    const apiKey = (body?.apiKey || '').trim() || BUNDLED_GEMINI_KEY;
    // Voz masculina neural realista (Puck = jovem/amigável, Orus = firme/consultor)
    const voiceName = body?.voiceName || 'Puck';

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent?key=${apiKey}`;

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: `Leia em português do Brasil com tom natural, amigável e fluido: ${cleanText}`,
              },
            ],
          },
        ],
        generationConfig: {
          responseModalities: ['AUDIO'],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: {
                voiceName,
              },
            },
          },
        },
      }),
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => null);
      return NextResponse.json(
        { error: errData?.error?.message || `HTTP ${res.status}` },
        { status: res.status },
      );
    }

    const data = await res.json();
    const inlineData = data?.candidates?.[0]?.content?.parts?.[0]?.inlineData;
    const pcmBase64 = inlineData?.data;

    if (!pcmBase64) {
      return NextResponse.json({ error: 'Áudio não retornado pelo modelo neural.' }, { status: 502 });
    }

    const rateMatch = String(inlineData?.mimeType || '').match(/rate=(\d+)/i);
    const sampleRate = rateMatch ? parseInt(rateMatch[1], 10) : 24000;

    const pcmBuffer = Buffer.from(pcmBase64, 'base64');
    const wavBuffer = pcm16ToWavBuffer(pcmBuffer, sampleRate);
    const wavBase64 = wavBuffer.toString('base64');

    return NextResponse.json({
      audioDataUrl: `data:audio/wav;base64,${wavBase64}`,
      voiceName,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || 'Erro ao gerar voz neural.' },
      { status: 500 },
    );
  }
}
