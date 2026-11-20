import { getApiUrl } from './apiService';

let activeXhr = null;
let reconnectTimer = null;
let isStopped = true;
let lastProcessedIdx = 0;
let debounceTimer = null;
const listeners = new Set();

/**
 * Inscreve um callback para receber eventos realtime do PostgreSQL (LISTEN db_changes via SSE /stream).
 */
export function subscribePostgresRealtime(callback) {
  if (typeof callback === 'function') {
    listeners.add(callback);
  }
  if (isStopped && listeners.size > 0) {
    startPostgresRealtimeStream();
  }
  return () => {
    listeners.delete(callback);
    if (listeners.size === 0) {
      stopPostgresRealtimeStream();
    }
  };
}

function notifyListeners(event) {
  if (!event || event.action === 'CONNECTED') return;
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    for (const cb of Array.from(listeners)) {
      try {
        cb(event);
      } catch {
        // ignore listener errors
      }
    }
  }, 180);
}

function parseSseChunk(chunk) {
  if (!chunk || typeof chunk !== 'string') return;
  const lines = chunk.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('data:')) {
      const jsonStr = trimmed.slice(5).trim();
      if (!jsonStr) continue;
      try {
        const parsed = JSON.parse(jsonStr);
        notifyListeners(parsed);
      } catch {
        // ignore partial frame
      }
    }
  }
}

export async function startPostgresRealtimeStream() {
  isStopped = false;
  if (activeXhr) return;

  try {
    const baseUrl = await getApiUrl();
    const streamUrl = `${baseUrl.replace(/\/+$/, '')}/stream`;

    const xhr = new XMLHttpRequest();
    activeXhr = xhr;
    lastProcessedIdx = 0;

    xhr.open('GET', streamUrl, true);
    xhr.setRequestHeader('Accept', 'text/event-stream');
    xhr.setRequestHeader('Cache-Control', 'no-cache');

    xhr.onreadystatechange = () => {
      if (xhr.readyState === 3 || xhr.readyState === 4) {
        if (xhr.status === 200 && typeof xhr.responseText === 'string') {
          const newText = xhr.responseText.slice(lastProcessedIdx);
          lastProcessedIdx = xhr.responseText.length;
          if (newText) {
            parseSseChunk(newText);
          }
        }
      }
      if (xhr.readyState === 4) {
        activeXhr = null;
        if (!isStopped) {
          scheduleReconnect(5000);
        }
      }
    };

    xhr.onerror = () => {
      activeXhr = null;
      if (!isStopped) {
        scheduleReconnect(6000);
      }
    };

    xhr.send();
  } catch {
    activeXhr = null;
    if (!isStopped) {
      scheduleReconnect(6000);
    }
  }
}

function scheduleReconnect(delayMs = 5000) {
  if (isStopped || reconnectTimer) return;
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    startPostgresRealtimeStream();
  }, delayMs);
}

export function stopPostgresRealtimeStream() {
  isStopped = true;
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  if (activeXhr) {
    try {
      activeXhr.abort();
    } catch {
      // ignore
    }
    activeXhr = null;
  }
}

/**
 * Emite um evento de alteração para o hub SSE do servidor caso uma escrita tenha acabado de ocorrer.
 */
export async function emitRealtimeChange(table = 'manual', action = 'UPDATE', data = null) {
  try {
    const baseUrl = await getApiUrl();
    await fetch(`${baseUrl.replace(/\/+$/, '')}/stream/emit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ table, action, data, timestamp: Date.now() }),
    });
  } catch {
    // ignore offline/unreachable
  }
}
