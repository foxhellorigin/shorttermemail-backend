import validator from 'validator';
import config from '../config/config.js';

// Validate email parameter
export const validateEmail = (req, res, next) => {
  const { email } = req.params;
  
  if (!email || !validator.isEmail(email)) {
    return res.status(400).json({
      success: false,
      error: 'Invalid email address',
      message: 'The provided email address is not valid.'
    });
  }
  
  // Check if email belongs to our supported domains
  const isValidDomain = config.email.allowedDomains.some(domain => 
    email.toLowerCase().endsWith(domain)
  );
  
  if (!isValidDomain) {
    return res.status(400).json({
      success: false,
      error: 'Unsupported email domain',
      message: 'The email domain is not supported by this service.',
      supportedDomains: config.email.allowedDomains
    });
  }
  
  next();
};

// Validate generate email request
export const validateGenerateEmailRequest = (req, res, next) => {
  const { type, custom } = req.body;
  
  // Validate type
  if (type && !['random', 'pronounceable'].includes(type)) {
    return res.status(400).json({
      success: false,
      error: 'Invalid email type',
      message: 'Email type must be either "random" or "pronounceable".'
    });
  }
  
  // Validate custom email part
  if (custom && !validator.isAlphanumeric(custom)) {
    return res.status(400).json({
      success: false,
      error: 'Invalid custom email part',
      message: 'Custom email part must contain only letters and numbers.'
    });
  }
  
  // Limit custom email length
  if (custom && custom.length > 20) {
    return res.status(400).json({
      success: false,
      error: 'Custom email part too long',
      message: 'Custom email part must be 20 characters or less.'
    });
  }
  
  next();
};

// Sanitize email content to prevent XSS
export const sanitizeEmailContent = (content) => {
  if (!content) return '';
  
  // Basic XSS prevention
  return content
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;')
    .replace(/\\/g, '&#x5C;')
    .replace(/`/g, '&#96;')
    .replace(/\$/g, '&#36;')
    .replace(/\(/g, '&#40;')
    .replace(/\)/g, '&#41;')
    .replace(/\{/g, '&#123;')
    .replace(/\}/g, '&#125;')
    .replace(/\[/g, '&#91;')
    .replace(/\]/g, '&#93;');
};

// Validate API key (for future use)
export const validateApiKey = (req, res, next) => {
  const apiKey = req.headers['x-api-key'];
  
  if (!apiKey) {
    return res.status(401).json({
      success: false,
      error: 'API key required',
      message: 'Please provide a valid API key.'
    });
  }
  
  // In a real application, you would validate against a database
  // For now, we'll use a simple environment variable check
  const validApiKey = process.env.API_KEY;
  if (validApiKey && apiKey !== validApiKey) {
    return res.status(403).json({
      success: false,
      error: 'Invalid API key',
      message: 'The provided API key is not valid.'
    });
  }
  
  next();
};