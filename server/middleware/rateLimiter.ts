import rateLimit, { Options } from 'express-rate-limit';
import type { Request, Response } from 'express';

// Standard response for rate limits
const createRateLimitResponse = (message: string) => {
  return {
    error: 'Too Many Requests',
    message,
  };
};

// Log rate limit events without sensitive data
const handler = (req: Request, res: Response, next: any, options: Options) => {
  console.warn(`[Rate Limit Exceeded] IP: ${req.ip}, Path: ${req.path}, Strategy: ${options.message?.message || 'Default'}`);
  res.status(options.statusCode || 429).json(options.message);
};

// 1. General Public Routes
export const publicLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per `window`
  message: createRateLimitResponse('Muitas requisições. Tente novamente mais tarde.'),
  handler,
  standardHeaders: true,
  legacyHeaders: false,
});

// 2. Authentication & Login
export const authLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 20, // Limit each IP to 20 auth requests per hour
  message: createRateLimitResponse('Muitas tentativas de autenticação. Tente novamente em uma hora.'),
  handler,
  standardHeaders: true,
  legacyHeaders: false,
});

// 3. Billing (except webhooks)
export const billingLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30, // Limit each IP to 30 billing requests per window
  message: createRateLimitResponse('Muitas requisições de faturamento. Tente novamente mais tarde.'),
  handler,
  standardHeaders: true,
  legacyHeaders: false,
});

// 4. AI & Gemini (High Cost)
export const aiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 15, // Limit each IP to 15 AI requests per window
  message: createRateLimitResponse('Muitas requisições de Inteligência Artificial. Tente novamente mais tarde.'),
  handler,
  standardHeaders: true,
  legacyHeaders: false,
});

// 5. Admin APIs
export const adminLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 50,
  message: createRateLimitResponse('Muitas requisições administrativas. Tente novamente mais tarde.'),
  handler,
  standardHeaders: true,
  legacyHeaders: false,
});
