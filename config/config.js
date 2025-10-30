import dotenv from 'dotenv';

dotenv.config();

const config = {
  // Server configuration
  server: {
    port: process.env.PORT || 3001,
    domain: process.env.DOMAIN || 'shorttermemail.com',
    protocol: process.env.PROTOCOL || 'https',
    host: process.env.HOST || '0.0.0.0'
  },

  // Email configuration
  email: {
    domain: process.env.EMAIL_DOMAIN || 'shorttermemail.com',
    allowedDomains: [
      'shorttermemail.com',
      'mail.shorttermemail.com',
      'inbox.shorttermemail.com'
    ],
    maxEmailsPerAddress: parseInt(process.env.MAX_EMAILS_PER_ADDRESS) || 50,
    emailExpiryHours: parseInt(process.env.EMAIL_EXPIRY_HOURS) || 24,
    maxEmailSize: parseInt(process.env.MAX_EMAIL_SIZE) || 1048576, // 1MB
    cleanupInterval: parseInt(process.env.CLEANUP_INTERVAL) || 3600000 // 1 hour
  },

  // Redis configuration
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT) || 6379,
    password: process.env.REDIS_PASSWORD || undefined,
    ttl: parseInt(process.env.REDIS_TTL) || 86400, // 24 hours in seconds
    keyPrefix: process.env.REDIS_KEY_PREFIX || 'shorttermemail:'
  },

  // SMTP configuration
  smtp: {
    port: parseInt(process.env.SMTP_PORT) || 25,
    host: process.env.SMTP_HOST || '0.0.0.0',
    disabledCommands: ['AUTH'],
    secure: false
  },

  // Rate limiting configuration
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
    max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
    emailGeneration: {
      windowMs: parseInt(process.env.EMAIL_GEN_WINDOW_MS) || 60 * 1000, // 1 minute
      max: parseInt(process.env.EMAIL_GEN_MAX_REQUESTS) || 10
    }
  },

  // Security configuration
  security: {
    corsOrigins: [
      'https://shorttermemail.com',
      'https://www.shorttermemail.com',
      'https://api.shorttermemail.com',
      'http://localhost:3000'
    ],
    allowedMethods: ['GET', 'POST', 'DELETE']
  }
};

// Validate required environment variables
const requiredEnvVars = ['DOMAIN'];
for (const envVar of requiredEnvVars) {
  if (!process.env[envVar] && !config.server[envVar.toLowerCase()]) {
    console.warn(`⚠️  Warning: Environment variable ${envVar} is not set`);
  }
}

export default config;