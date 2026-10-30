/**
 * Sanitizador de prompts e redator de credenciais para blindagem de IA e logs.
 */

// Padrões de injeção de prompt conhecidos
const INJECTION_PATTERNS = [
  /ignore\s+(all\s+)?(previous|prior)\s+instructions/gi,
  /desconsidere\s+(todas\s+as\s+)?instruções\s+anteriores/gi,
  /você\s+agora\s+é\s+um(a)?\s+nova\s+ia/gi,
  /you\s+are\s+now\s+a\s+different\s+ai/gi,
  /system\s*:\s*/gi,
  /system_override/gi,
  /print\s+database\s+schema/gi,
  /drop\s+table/gi,
  /select\s+.*\s+from\s+users/gi,
];

// Padrões de vazamento de credenciais (tokens JWT, secrets, senhas)
const SENSITIVE_PATTERNS = [
  { pattern: /eyJ[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}/g, mask: '[JWT_TOKEN_REDACTED]' },
  { pattern: /(?:PLUGGY_CLIENT_SECRET|clientSecret|secret)\s*[:=]\s*["']?[a-zA-Z0-9_\-]{8,}["']?/gi, mask: 'clientSecret: [REDACTED]' },
  { pattern: /(?:password|senha)\s*[:=]\s*["']?[^"'\s]{4,}["']?/gi, mask: 'password: [REDACTED]' },
  { pattern: /AIza[0-9A-Za-z-_]{35}/g, mask: '[GEMINI_API_KEY_REDACTED]' },
];

export function sanitizePromptInput(input: string): string {
  if (!input) return '';
  let sanitized = input;

  for (const regex of INJECTION_PATTERNS) {
    sanitized = sanitized.replace(regex, '[POTENTIAL_INJECTION_REMOVED]');
  }

  for (const { pattern, mask } of SENSITIVE_PATTERNS) {
    sanitized = sanitized.replace(pattern, mask);
  }

  return sanitized.trim();
}

export function maskSensitiveData(data: string): string {
  if (!data) return '';
  let masked = data;
  for (const { pattern, mask } of SENSITIVE_PATTERNS) {
    masked = masked.replace(pattern, mask);
  }
  return masked;
}

