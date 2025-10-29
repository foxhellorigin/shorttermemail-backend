const config = {
    // Server configuration
    server: {
        port: process.env.PORT || 3001,
        domain: process.env.DOMAIN || 'shorttermemail.com',
        protocol: process.env.PROTOCOL || 'https'
    },

    // Email configuration
    email: {
        domain: process.env.EMAIL_DOMAIN || 'shorttermemail.com',
        maxEmailsPerAddress: parseInt(process.env.MAX_EMAILS_PER_ADDRESS) || 50,
        emailExpiryHours: parseInt(process.env.EMAIL_EXPIRY_HOURS) || 24,
        maxEmailSize: parseInt(process.env.MAX_EMAIL_SIZE) || 1024 * 1024, // 1MB
        allowedDomains: [
            'shorttermemail.com',
            'mail.shorttermemail.com'
        ]
    },

    // Redis configuration
    redis: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT) || 6379,
        password: process.env.REDIS_PASSWORD || null,
        ttl: parseInt(process.env.REDIS_TTL) || 86400, // 24 hours in seconds
        keyPrefix: 'shorttermemail:'
    },

    // SMTP configuration
    smtp: {
        port: parseInt(process.env.SMTP_PORT) || 25,
        host: process.env.SMTP_HOST || '0.0.0.0',
        disabledCommands: ['AUTH']
    },

    // Rate limiting
    rateLimit: {
        windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
        max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
        emailGeneration: {
            windowMs: parseInt(process.env.EMAIL_GEN_WINDOW_MS) || 60 * 1000, // 1 minute
            max: parseInt(process.env.EMAIL_GEN_MAX_REQUESTS) || 10
        }
    }
};

export default config;