const helmet = require('helmet');
const { rateLimit } = require('express-rate-limit');

const securityHeaders = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      baseUri: ["'none'"],
      objectSrc: ["'none'"],
      frameAncestors: ["'none'"],
      formAction: ["'self'"],
    },
  },
  crossOriginResourcePolicy: { policy: 'same-site' },
  referrerPolicy: { policy: 'no-referrer' },
});

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 500,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { code: 'RATE_LIMITED', message: 'Terlalu banyak permintaan. Silakan coba lagi sebentar.' },
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 12,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  message: { code: 'AUTH_RATE_LIMITED', message: 'Terlalu banyak percobaan masuk. Coba lagi dalam 15 menit.' },
});

function isAllowedOrigin(req, origin, allowedOrigins = []) {
  if (!origin) return false;
  if (allowedOrigins.includes(origin)) return true;
  try {
    const candidate = new URL(origin);
    const requestHost = (req.get('x-forwarded-host') || req.get('host') || '').split(',')[0].trim();
    const requestProtocol = (req.get('x-forwarded-proto') || req.protocol || '').split(',')[0].trim().replace(/:$/, '');
    return candidate.host.toLowerCase() === requestHost.toLowerCase()
      && candidate.protocol === `${requestProtocol}:`;
  } catch {
    return false;
  }
}

const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 30,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { code: 'UPLOAD_RATE_LIMITED', message: 'Terlalu banyak unggahan. Coba lagi nanti.' },
});

function noStore(req, res, next) {
  if (req.path.startsWith('/api/')) res.set('Cache-Control', 'no-store');
  next();
}

module.exports = { securityHeaders, apiLimiter, authLimiter, uploadLimiter, noStore, isAllowedOrigin };
