import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import { createServer } from 'http';
import { Server } from 'socket.io';
import redisClient from './config/redis.js';
import { apiLimiter, emailGenerationLimiter } from './middleware/rateLimit.js';
import { validateEmail, validateGenerateEmailRequest } from './middleware/validation.js';
import { generateRandomEmail } from './utils/emailGenerator.js';
import config from './config/config.js';

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: [
      "https://shorttermemail.com",
      "https://www.shorttermemail.com",
      "https://api.shorttermemail.com"
    ],
    methods: ["GET", "POST"]
  }
});

// Middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "wss://api.shorttermemail.com"]
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
    'https://api.shorttermemail.com'
  ],
  credentials: true
}));
app.use(express.json());

// Rate limiting
app.use('/api/', apiLimiter);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    service: 'ShortTermEmail API',
    version: '1.0.0',
    domain: config.server.domain
  });
});

// Service information
app.get('/api/info', (req, res) => {
  res.json({
    service: 'ShortTermEmail API',
    version: '1.0.0',
    domain: config.server.domain,
    website: 'https://shorttermemail.com',
    endpoints: {
      generateEmail: 'POST /api/generate-email',
      getEmails: 'GET /api/emails/:email',
      deleteEmail: 'DELETE /api/emails/:email',
      health: 'GET /api/health'
    },
    features: [
      '24-hour temporary emails',
      'Real-time email updates',
      'Multiple domain support',
      'No registration required'
    ]
  });
});

// Generate new temporary email
app.post('/api/generate-email', emailGenerationLimiter, validateGenerateEmailRequest, async (req, res) => {
  try {
    const email = generateRandomEmail();
    const emailData = {
      email,
      created: Date.now(),
      expires: Date.now() + (24 * 60 * 60 * 1000), // 24 hours
      emails: []
    };

    await redisClient.setEx(`email:${email}`, 86400, JSON.stringify(emailData));
    
    res.json({
      success: true,
      email,
      expires: emailData.expires,
      message: 'Temporary email created successfully'
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
    
    // Validate domain
    const validDomains = [
      'shorttermemail.com',
      'mail.shorttermemail.com'
    ];
    
    const isValidDomain = validDomains.some(domain => email.endsWith(domain));
    if (!isValidDomain) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid email domain' 
      });
    }

    const data = await redisClient.get(`email:${email}`);
    
    if (!data) {
      return res.status(404).json({ 
        success: false, 
        error: 'Email not found or expired' 
      });
    }

    const emailData = JSON.parse(data);
    res.json({
      success: true,
      emails: emailData.emails,
      expires: emailData.expires,
      created: emailData.created
    });
  } catch (error) {
    console.error('Error fetching emails:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Internal server error' 
    });
  }
});

// Delete email address
app.delete('/api/emails/:email', validateEmail, async (req, res) => {
  try {
    const { email } = req.params;
    await redisClient.del(`email:${email}`);
    res.json({ 
      success: true, 
      message: 'Email deleted successfully' 
    });
  } catch (error) {
    console.error('Error deleting email:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Internal server error' 
    });
  }
});

// Statistics endpoint
app.get('/api/stats', async (req, res) => {
  try {
    const keys = await redisClient.keys('email:*');
    const activeEmails = keys.length;
    
    res.json({
      success: true,
      stats: {
        activeEmails,
        service: 'ShortTermEmail API',
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Error getting stats:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Internal server error' 
    });
  }
});

// Socket.io for real-time updates
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('subscribe', (email) => {
    if (email && typeof email === 'string') {
      socket.join(email);
      console.log(`User ${socket.id} subscribed to ${email}`);
    }
  });

  socket.on('unsubscribe', (email) => {
    if (email && typeof email === 'string') {
      socket.leave(email);
      console.log(`User ${socket.id} unsubscribed from ${email}`);
    }
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

// Export io for use in SMTP server
app.set('io', io);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ 
    success: false, 
    error: 'Internal server error' 
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ 
    success: false, 
    error: 'Endpoint not found' 
  });
});

const PORT = process.env.PORT || 3001;

server.listen(PORT, () => {
  console.log(`🚀 ShortTermEmail API Server running on port ${PORT}`);
  console.log(`🌐 Domain: ${config.server.domain}`);
  console.log(`🔗 API Base: https://api.${config.server.domain}`);
  console.log(`📧 Email domains: ${config.email.allowedDomains.join(', ')}`);
});

export { app, io };