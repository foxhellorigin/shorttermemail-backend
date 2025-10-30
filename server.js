import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import redisClient from './config/redis.js';
import { apiLimiter, emailGenerationLimiter } from './middleware/rateLimit.js';
import { validateEmail, validateGenerateEmailRequest } from './middleware/validation.js';
import { generateRandomEmail, generatePronounceableEmail } from './utils/emailGenerator.js';
import config from './config/config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: [
      'https://shorttermemail.com',
      'https://www.shorttermemail.com',
      'https://api.shorttermemail.com',
      'http://localhost:3000'
    ],
    methods: ['GET', 'POST']
  }
});

// Middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "https://api.shorttermemail.com", "wss://api.shorttermemail.com"]
    }
  },
  crossOriginEmbedderPolicy: false
}));

app.use(compression());
app.use(morgan('combined'));
app.use(cors({
  origin: [
    'https://shorttermemail.com',
    'https://www.shorttermemail.com',
    'https://api.shorttermemail.com',
    'http://localhost:3000'
  ],
  credentials: true,
  methods: ['GET', 'POST', 'DELETE']
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Rate limiting
app.use('/api/', apiLimiter);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    service: 'ShortTermEmail API',
    version: '1.0.0',
    domain: config.server.domain,
    environment: process.env.NODE_ENV || 'development'
  });
});

// Server information
app.get('/api/info', (req, res) => {
  res.json({
    service: 'ShortTermEmail',
    version: '1.0.0',
    domain: config.server.domain,
    website: 'https://shorttermemail.com',
    api: 'https://api.shorttermemail.com',
    features: [
      '24-hour temporary emails',
      'No registration required',
      'Real-time email updates',
      'Multiple domains supported',
      'Arabic and English support',
      'RESTful API'
    ],
    domains: config.email.allowedDomains,
    limits: {
      maxEmailsPerAddress: config.email.maxEmailsPerAddress,
      emailExpiryHours: config.email.emailExpiryHours,
      maxEmailSize: config.email.maxEmailSize
    }
  });
});

// Generate new temporary email
app.post('/api/generate-email', emailGenerationLimiter, validateGenerateEmailRequest, async (req, res) => {
  try {
    const { type = 'random', custom } = req.body;
    let email;

    if (custom && /^[a-zA-Z0-9]+$/.test(custom)) {
      const domains = config.email.allowedDomains;
      const domain = domains[Math.floor(Math.random() * domains.length)];
      email = `${custom}@${domain}`;
    } else if (type === 'pronounceable') {
      email = generatePronounceableEmail();
    } else {
      email = generateRandomEmail();
    }

    const emailData = {
      email,
      created: Date.now(),
      expires: Date.now() + (config.email.emailExpiryHours * 60 * 60 * 1000),
      emails: [],
      language: req.headers['accept-language']?.includes('ar') ? 'ar' : 'en'
    };

    // Store in Redis with TTL
    await redisClient.setEx(
      `email:${email}`,
      config.redis.ttl,
      JSON.stringify(emailData)
    );

    console.log(`📧 New email generated: ${email}`);

    res.json({
      success: true,
      email,
      expires: emailData.expires,
      message: 'Temporary email created successfully',
      type: type || 'random'
    });

  } catch (error) {
    console.error('Error generating email:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: 'Failed to generate email'
    });
  }
});

// Get emails for an address
app.get('/api/emails/:email', validateEmail, async (req, res) => {
  try {
    const { email } = req.params;

    const data = await redisClient.get(`email:${email}`);
    
    if (!data) {
      return res.status(404).json({
        success: false,
        error: 'Email not found',
        message: 'The requested email address does not exist or has expired'
      });
    }

    const emailData = JSON.parse(data);
    
    // Check if email has expired
    if (Date.now() > emailData.expires) {
      await redisClient.del(`email:${email}`);
      return res.status(410).json({
        success: false,
        error: 'Email expired',
        message: 'This temporary email has expired'
      });
    }

    res.json({
      success: true,
      emails: emailData.emails,
      expires: emailData.expires,
      created: emailData.created,
      total: emailData.emails.length
    });

  } catch (error) {
    console.error('Error fetching emails:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: 'Failed to fetch emails'
    });
  }
});

// Delete email address
app.delete('/api/emails/:email', validateEmail, async (req, res) => {
  try {
    const { email } = req.params;

    const deleted = await redisClient.del(`email:${email}`);
    
    if (deleted) {
      console.log(`🗑️ Email deleted: ${email}`);
      res.json({
        success: true,
        message: 'Email address deleted successfully'
      });
    } else {
      res.status(404).json({
        success: false,
        error: 'Email not found',
        message: 'The requested email address does not exist'
      });
    }

  } catch (error) {
    console.error('Error deleting email:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: 'Failed to delete email'
    });
  }
});

// Statistics endpoint
app.get('/api/stats', async (req, res) => {
  try {
    const keys = await redisClient.keys('email:*');
    const activeEmails = keys.length;
    
    let totalEmails = 0;
    for (const key of keys) {
      const data = await redisClient.get(key);
      if (data) {
        const emailData = JSON.parse(data);
        totalEmails += emailData.emails.length;
      }
    }

    res.json({
      success: true,
      stats: {
        activeEmails,
        totalEmailsReceived: totalEmails,
        service: 'ShortTermEmail',
        version: '1.0.0',
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
        memory: process.memoryUsage(),
        domains: config.email.allowedDomains
      }
    });

  } catch (error) {
    console.error('Error getting stats:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: 'Failed to retrieve statistics'
    });
  }
});

// Cleanup expired emails endpoint (admin)
app.post('/api/cleanup', async (req, res) => {
  try {
    const keys = await redisClient.keys('email:*');
    let cleanedCount = 0;

    for (const key of keys) {
      const data = await redisClient.get(key);
      if (data) {
        const emailData = JSON.parse(data);
        if (Date.now() > emailData.expires) {
          await redisClient.del(key);
          cleanedCount++;
        }
      }
    }

    console.log(`🧹 Cleaned up ${cleanedCount} expired emails`);
    
    res.json({
      success: true,
      message: `Cleaned up ${cleanedCount} expired emails`,
      cleaned: cleanedCount
    });

  } catch (error) {
    console.error('Error during cleanup:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: 'Failed to cleanup expired emails'
    });
  }
});

// Socket.io for real-time updates
io.on('connection', (socket) => {
  console.log(`🔌 User connected: ${socket.id}`);

  socket.on('subscribe', (email) => {
    if (email && typeof email === 'string' && email.includes('@')) {
      socket.join(email);
      console.log(`📨 User ${socket.id} subscribed to ${email}`);
    }
  });

  socket.on('unsubscribe', (email) => {
    if (email && typeof email === 'string') {
      socket.leave(email);
      console.log(`📭 User ${socket.id} unsubscribed from ${email}`);
    }
  });

  socket.on('disconnect', (reason) => {
    console.log(`🔌 User disconnected: ${socket.id} (${reason})`);
  });
});

// Export io for use in SMTP server
app.set('io', io);

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('Unhandled error:', error);
  res.status(500).json({
    success: false,
    error: 'Internal server error',
    message: 'Something went wrong'
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found',
    message: 'The requested endpoint does not exist'
  });
});

const PORT = config.server.port;

server.listen(PORT, () => {
  console.log('🚀 ShortTermEmail Backend Server Started');
  console.log(`📍 Port: ${PORT}`);
  console.log(`🌐 Domain: ${config.server.domain}`);
  console.log(`🔗 API: https://api.${config.server.domain}`);
  console.log(`📧 SMTP: mail.${config.server.domain}:25`);
  console.log(`⚡ Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`📊 Redis: ${config.redis.host}:${config.redis.port}`);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('🛑 Received SIGTERM, shutting down gracefully...');
  await redisClient.quit();
  server.close(() => {
    console.log('✅ Server shut down successfully');
    process.exit(0);
  });
});

process.on('SIGINT', async () => {
  console.log('🛑 Received SIGINT, shutting down gracefully...');
  await redisClient.quit();
  server.close(() => {
    console.log('✅ Server shut down successfully');
    process.exit(0);
  });
});

export { app, io };