import validator from 'validator';
import config from '../config/config.js';

const validateEmail = (req, res, next) => {
    const { email } = req.params;
    
    if (!email || !validator.isEmail(email)) {
        return res.status(400).json({
            success: false,
            error: 'Invalid email address format'
        });
    }
    
    const isValidDomain = config.email.allowedDomains.some(domain => 
        email.endsWith(domain)
    );
    
    if (!isValidDomain) {
        return res.status(400).json({
            success: false,
            error: 'Email domain not supported'
        });
    }
    
    next();
};

const sanitizeEmailContent = (content) => {
    if (!content) return '';
    
    return content
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#x27;')
        .replace(/\//g, '&#x2F;')
        .replace(/\\/g, '&#x5C;')
        .replace(/`/g, '&#96;');
};

const validateGenerateEmailRequest = (req, res, next) => {
    const { custom } = req.body;
    
    if (custom && !validator.isAlphanumeric(custom)) {
        return res.status(400).json({
            success: false,
            error: 'Custom email part must be alphanumeric'
        });
    }
    
    next();
};

export {
    validateEmail,
    sanitizeEmailContent,
    validateGenerateEmailRequest
};