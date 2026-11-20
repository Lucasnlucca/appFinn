import { NextRequest } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type SseController = ReadableStreamDefaultController<Uint8Array>;

const globalForSse = globalThis as unknown as {
  __finnSseClients?: Set<SseController>;
};

const clients = globalForSse.__finnSseClients || new Set<SseController>();
globalForSse.__finnSseClients = clients;

function broadcastLocalSse(payload: Record<string, any>) {
  const enc = new TextEncoder();
  const frame = enc.encode(`data: ${JSON.stringify(payload)}\n\n`);
  for (const ctrl of Array.from(clients)) {
    try {
      ctrl.enqueue(frame);
    } catch {
      clients.delete(ctrl);
    }
  }
}

export async function GET(req: NextRequest) {
  const enc = new TextEncoder();
  let controllerRef: SseController | null = null;
  let heartbeat: NodeJS.Timeout | null = null;

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controllerRef = controller;
      clients.add(controller);

      controller.enqueue(
        enc.encode(
          `data: ${JSON.stringify({
            table: 'system',
            action: 'CONNECTED',
            data: { channel: 'db_changes' },
            timestamp: Date.now(),
          })}\n\n`,
        ),
      );

      heartbeat = setInterval(() => {
        try {
          controller.enqueue(enc.encode(`: heartbeat ${Date.now()}\n\n`));
        } catch {
          if (controllerRef) clients.delete(controllerRef);
          if (heartbeat) clearInterval(heartbeat);
        }
      }, 20000);
    },
    cancel() {
      if (heartbeat) clearInterval(heartbeat);
      if (controllerRef) clients.delete(controllerRef);
    },
  });

  req.signal.addEventListener('abort', () => {
    if (heartbeat) clearInterval(heartbeat);
    if (controllerRef) clients.delete(controllerRef);
  });

  return new Response(stream, {
    status: 200,
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    broadcastLocalSse({
      table: body?.table || 'manual',
      action: body?.action || 'UPDATE',
      data: body?.data || null,
      timestamp: Date.now(),
    });
    return Response.json({ ok: true });
  } catch {
    return Response.json({ ok: false }, { status: 400 });
  }
}
