import SMTPServer from 'smtp-server';
import redisClient from './config/redis.js';
import { sanitizeEmailContent } from './middleware/validation.js';
import config from './config/config.js';
import { io } from './server.js';

class ShortTermSMTPServer {
  constructor() {
    this.server = null;
    this.init();
  }

  init() {
    this.server = new SMTPServer({
      disabledCommands: ['AUTH', 'STARTTLS'],
      secure: false,
      logger: false,
      hideSTARTTLS: true,
      allowInsecureAuth: true,
      size: config.email.maxEmailSize,
      onAuth: this.onAuth.bind(this),
      onMailFrom: this.onMailFrom.bind(this),
      onRcptTo: this.onRcptTo.bind(this),
      onData: this.onData.bind(this)
    });

    this.setupEventHandlers();
  }

  onAuth(auth, session, callback) {
    // Allow anonymous access for temporary emails
    callback(null, { user: 'anonymous' });
  }

  onMailFrom(address, session, callback) {
    // Accept mail from any address
    callback();
  }

  onRcptTo(address, session, callback) {
    const toEmail = address.address.toLowerCase();
    
    // Check if this is one of our valid domains
    const isValidDomain = config.email.allowedDomains.some(domain => 
      toEmail.endsWith(domain)
    );

    if (!isValidDomain) {
      return callback(new Error('Not a valid ShortTermEmail domain'));
    }

    callback();
  }

  async onData(stream, session, callback) {
    let emailData = '';
    const email = {
      id: this.generateId(),
      from: session.envelope.mailFrom?.address || 'unknown@unknown.com',
      to: session.envelope.rcptTo[0]?.address,
      subject: 'No Subject',
      body: '',
      html: null,
      timestamp: new Date().toISOString(),
      read: false,
      size: 0
    };

    stream.on('data', (chunk) => {
      emailData += chunk.toString();
    });

    stream.on('end', async () => {
      try {
        email.size = Buffer.byteLength(emailData, 'utf8');
        
        // Parse email content
        this.parseEmailContent(emailData, email);
        
        // Sanitize content for security
        email.subject = sanitizeEmailContent(email.subject);
        email.body = sanitizeEmailContent(email.body);
        if (email.html) {
          email.html = sanitizeEmailContent(email.html);
        }
        
        // Store in Redis
        await this.storeEmail(email);
        
        console.log(`📩 New email received for: ${email.to}`);
        console.log(`   From: ${email.from}`);
        console.log(`   Subject: ${email.subject}`);
        console.log(`   Size: ${email.size} bytes`);
        
        callback();
      } catch (error) {
        console.error('Error processing email:', error);
        callback(error);
      }
    });

    stream.on('error', (error) => {
      console.error('Stream error:', error);
      callback(error);
    });
  }

  parseEmailContent(emailData, email) {
    const lines = emailData.split('\n');
    let inHeaders = true;
    let inBody = false;
    let bodyLines = [];
    let currentPart = '';
    let isMultipart = false;
    let boundary = '';
    let contentType = 'text/plain';

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      if (inHeaders) {
        if (line === '') {
          inHeaders = false;
          inBody = true;
          continue;
        }

        if (line.toLowerCase().startsWith('subject:')) {
          email.subject = line.substring(8).trim();
        } else if (line.toLowerCase().startsWith('content-type:')) {
          contentType = line.substring(13).trim();
          if (contentType.includes('multipart/')) {
            isMultipart = true;
            const boundaryMatch = line.match(/boundary="?([^";]+)"?/);
            if (boundaryMatch) {
              boundary = boundaryMatch[1];
            }
          }
        }
      } else if (inBody) {
        if (isMultipart && boundary) {
          // Handle multipart content
          if (line === `--${boundary}`) {
            if (currentPart) {
              this.processMultipartPart(currentPart, email);
              currentPart = '';
            }
          } else if (line === `--${boundary}--`) {
            if (currentPart) {
              this.processMultipartPart(currentPart, email);
            }
            break;
          } else {
            currentPart += line + '\n';
          }
        } else {
          // Simple email body
          if (!line.startsWith('--') && !line.startsWith('Content-')) {
            bodyLines.push(line);
          }
        }
      }
    }

    // Process remaining body content
    if (bodyLines.length > 0 && !email.body) {
      email.body = bodyLines.join('\n').trim();
    }

    // Ensure we have at least some body content
    if (!email.body || email.body === '') {
      email.body = 'No content';
    }
  }

  processMultipartPart(part, email) {
    const partLines = part.split('\n');
    let inHeaders = true;
    let partBody = [];
    let contentType = 'text/plain';
    let charset = 'utf-8';

    for (const line of partLines) {
      if (inHeaders) {
        if (line.trim() === '') {
          inHeaders = false;
          continue;
        }
        if (line.toLowerCase().startsWith('content-type:')) {
          contentType = line.substring(13).trim();
          const charsetMatch = contentType.match(/charset="?([^";]+)"?/);
          if (charsetMatch) {
            charset = charsetMatch[1];
          }
        }
      } else {
        partBody.push(line);
      }
    }

    const bodyContent = partBody.join('\n').trim();
    
    if (contentType.includes('text/html')) {
      email.html = bodyContent;
    } else if (contentType.includes('text/plain') && !email.body) {
      email.body = bodyContent;
    }
  }

  async storeEmail(email) {
    const key = `email:${email.to}`;
    const existingData = await redisClient.get(key);
    
    if (existingData) {
      const emailData = JSON.parse(existingData);
      
      // Limit number of stored emails
      if (emailData.emails.length >= config.email.maxEmailsPerAddress) {
        emailData.emails.shift(); // Remove oldest email
      }
      
      emailData.emails.push(email);
      await redisClient.setEx(key, config.redis.ttl, JSON.stringify(emailData));
      
      // Notify connected clients via Socket.io
      if (io) {
        io.to(email.to).emit('new-email', email);
      }
    }
  }

  generateId() {
    return Math.random().toString(36).substring(2) + Date.now().toString(36);
  }

  setupEventHandlers() {
    this.server.on('error', (err) => {
      console.error('❌ SMTP Server Error:', err);
    });

    this.server.on('close', () => {
      console.log('🛑 SMTP Server closed');
    });
  }

  start() {
    const PORT = config.smtp.port;
    const HOST = config.smtp.host;

    this.server.listen(PORT, HOST, () => {
      console.log('📧 ShortTermEmail SMTP Server Started');
      console.log(`📍 Host: ${HOST}:${PORT}`);
      console.log(`✅ Ready to receive emails for domains:`);
      config.email.allowedDomains.forEach(domain => {
        console.log(`   - @${domain}`);
      });
    });
  }
}

// Start SMTP server
const smtpServer = new ShortTermSMTPServer();
smtpServer.start();

export default smtpServer;