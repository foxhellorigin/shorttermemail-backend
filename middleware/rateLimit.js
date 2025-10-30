import rateLimit from 'express-rate-limit';
import config from '../config/config.js';

// General API rate limiter
export const apiLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.max,
  message: {
    success: false,
    error: 'Too many requests',
    message: 'Too many requests from this IP, please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // Skip rate limiting for health checks
    return req.path === '/api/health';
  },
  handler: (req, res) => {
    res.status(429).json({
      success: false,
      error: 'Rate limit exceeded',
      message: 'Too many requests from this IP, please try again later.'
    });
  }
});

// Email generation rate limiter (more strict)
export const emailGenerationLimiter = rateLimit({
  windowMs: config.rateLimit.emailGeneration.windowMs,
  max: config.rateLimit.emailGeneration.max,
  message: {
    success: false,
    error: 'Too many email generations',
    message: 'Too many email generation requests, please slow down.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json({
      success: false,
      error: 'Email generation limit exceeded',
      message: 'Too many email generation requests, please try again in a minute.'
    });
  }
});

// SMTP rate limiter (for email reception)
export const smtpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // Higher limit for SMTP
  message: {
    success: false,
    error: 'Too many SMTP requests'
  },
  skip: (req) => {
    // Skip for certain conditions if needed
    return false;
  }
});