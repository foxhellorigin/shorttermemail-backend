import SMTPServer from 'smtp-server';
import redisClient from './config/redis.js';
import { sanitizeEmailContent } from './middleware/validation.js';
import config from './config/config.js';

// Import io from server (this will be set when server starts)
let io = null;

class ShortTermSMTPServer {
    constructor() {
        this.server = null;
    }

    setSocketIO(socketIO) {
        io = socketIO;
    }

    init() {
        this.server = new SMTPServer.SMTPServer({
            disabledCommands: ['AUTH', 'STARTTLS'],
            secure: false,
            logger: false,
            hideSTARTTLS: true,
            allowInsecureAuth: true,
            size: config.email.maxEmailSize,

            onAuth(auth, session, callback) {
                // Allow anonymous access for temporary emails
                return callback(null, { user: 'anonymous' });
            },

            onMailFrom(address, session, callback) {
                // Accept mail from any address
                return callback();
            },

            onRcptTo(address, session, callback) {
                const toEmail = address.address.toLowerCase();
                
                // Check if this is one of our domains
                const isValidDomain = config.email.allowedDomains.some(domain => 
                    toEmail.endsWith(domain)
                );

                if (!isValidDomain) {
                    return callback(new Error('Not a valid ShortTermEmail domain'));
                }

                return callback();
            },

            onData: this.processEmail.bind(this)
        });

        this.setupEventHandlers();
    }

    async processEmail(stream, session, callback) {
        let emailData = '';
        let email = {
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
            emailData += chunk.toString('utf8');
        });

        stream.on('end', async () => {
            try {
                email.size = Buffer.byteLength(emailData, 'utf8');
                
                // Parse email content
                this.parseEmailContent(emailData, email);
                
                // Sanitize content
                email.subject = sanitizeEmailContent(email.subject);
                email.body = sanitizeEmailContent(email.body);
                
                // Store in Redis
                await this.storeEmail(email);
                
                console.log(`📩 New email received for: ${email.to} from: ${email.from} subject: "${email.subject}"`);
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
        const lines = emailData.split('\r\n');
        let inHeaders = true;
        let inBody = false;
        let bodyLines = [];
        let currentPart = '';
        let isMultipart = false;
        let boundary = '';

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];

            if (inHeaders) {
                if (line === '') {
                    inHeaders = false;
                    inBody = true;
                    continue;
                }

                if (line.toLowerCase().startsWith('subject:')) {
                    email.subject = line.substring(8).trim();
                } else if (line.toLowerCase().startsWith('content-type:')) {
                    if (line.includes('multipart/')) {
                        isMultipart = true;
                        const boundaryMatch = line.match(/boundary="?([^";]+)"?/);
                        if (boundaryMatch) {
                            boundary = boundaryMatch[1];
                        }
                    }
                }
            } else if (inBody) {
                if (isMultipart && boundary) {
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
                    if (!line.startsWith('--') && !line.toLowerCase().startsWith('content-')) {
                        bodyLines.push(line);
                    }
                }
            }
        }

        if (bodyLines.length > 0 && !email.body) {
            email.body = bodyLines.join('\n').trim();
        }

        if (!email.body || email.body === '') {
            email.body = 'No content';
        }
    }

    processMultipartPart(part, email) {
        const partLines = part.split('\n');
        let inHeaders = true;
        let partBody = [];
        let contentType = 'text/plain';

        for (const line of partLines) {
            if (inHeaders) {
                if (line.trim() === '') {
                    inHeaders = false;
                    continue;
                }
                if (line.toLowerCase().startsWith('content-type:')) {
                    contentType = line.substring(13).trim();
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
                emailData.emails.shift();
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
            console.error('SMTP Server Error:', err);
        });

        this.server.on('close', () => {
            console.log('SMTP Server closed');
        });
    }

    start() {
        const PORT = config.smtp.port;
        const HOST = config.smtp.host;

        this.server.listen(PORT, HOST, () => {
            console.log(`📧 ShortTermEmail SMTP Server running on ${HOST}:${PORT}`);
            console.log(`✅ Ready to receive emails for: ${config.email.allowedDomains.join(', ')}`);
        });
    }
}

// Create and export SMTP server instance
const smtpServer = new ShortTermSMTPServer();
smtpServer.init();

export default smtpServer;