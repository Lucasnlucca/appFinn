export default () => ({
  port: parseInt(process.env.PORT || '4000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  appName: process.env.APP_NAME || 'FINN AI',
  corsOrigins: (process.env.CORS_ORIGINS || 'http://localhost:3000,http://127.0.0.1:3000').split(','),
  sessionSecret: process.env.SESSION_SECRET || 'default-session-secret-change-me',
  encryptionKey: process.env.ENCRYPTION_KEY || '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET || 'default-jwt-access-secret-32-chars-min',
    refreshSecret: process.env.JWT_REFRESH_SECRET || 'default-jwt-refresh-secret-32-chars-min',
    accessExpiration: process.env.JWT_ACCESS_EXPIRATION || '15m',
    refreshExpiration: process.env.JWT_REFRESH_EXPIRATION || '7d',
  },
  database: {
    url: process.env.DATABASE_URL,
  },
  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
  },
  gemini: {
    apiKey: process.env.GEMINI_API_KEY,
    model: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
  },
  pluggy: {
    clientId: process.env.PLUGGY_CLIENT_ID,
    clientSecret: process.env.PLUGGY_CLIENT_SECRET,
    mode: process.env.PLUGGY_MODE || 'personal',
    baseUrl: process.env.PLUGGY_BASE_URL || 'https://api.pluggy.ai',
  },
});

