const { db } = require('../config/db');
const { readSessionCookie, verifyToken } = require('../utils/session');

async function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  const bearer = typeof authHeader === 'string' && authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  const cookieToken = readSessionCookie(req.headers.cookie);
  const token = bearer || cookieToken;
  if (!token) return res.status(401).json({ code: 'AUTH_REQUIRED', message: 'Silakan masuk untuk melanjutkan.' });
  let decoded;
  try {
    decoded = verifyToken(token);
  } catch {
    return res.status(401).json({ code: 'INVALID_SESSION', message: 'Token tidak valid atau sudah kedaluwarsa.' });
  }
  if (!bearer && !['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    const origin = req.get('origin');
    const allowedOrigins = req.app.locals.allowedOrigins || [];
    if (!origin || !allowedOrigins.includes(origin)) {
      return res.status(403).json({ code: 'INVALID_ORIGIN', message: 'Permintaan tidak berasal dari aplikasi yang diizinkan.' });
    }
  }
  const userId = Number(decoded.sub);
  if (!Number.isInteger(userId) || userId < 1) return res.status(401).json({ code: 'INVALID_SESSION', message: 'Sesi tidak valid.' });
  const { rows } = await db.query('SELECT id, name, email, role FROM users WHERE id = $1', [userId]);
  if (!rows[0]) return res.status(401).json({ code: 'INVALID_SESSION', message: 'Sesi tidak valid. Silakan masuk kembali.' });
  req.user = rows[0];
  next();
}
module.exports = { authenticate };
