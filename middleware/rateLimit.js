import rateLimit from 'express-rate-limit';
import config from '../config/config.js';

const apiLimiter = rateLimit({
    windowMs: config.rateLimit.windowMs,
    max: config.rateLimit.max,
    message: {
        success: false,
        error: 'Too many requests from this IP, please try again later.'
    },
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => {
        return req.path === '/api/health';
    }
});

const emailGenerationLimiter = rateLimit({
    windowMs: config.rateLimit.emailGeneration.windowMs,
    max: config.rateLimit.emailGeneration.max,
    message: {
        success: false,
        error: 'Too many email generations, please slow down.'
    },
    standardHeaders: true,
    legacyHeaders: false
});

const smtpLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 1000,
    message: {
        success: false,
        error: 'Too many SMTP requests'
    }
});

export {
    apiLimiter,
    emailGenerationLimiter,
    smtpLimiter
};