const jwt = require('jsonwebtoken');
const { db } = require('../config/db');

async function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  const token = typeof authHeader === 'string' && authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  if (!token) return res.status(401).json({ code: 'AUTH_REQUIRED', message: 'Silakan masuk untuk melanjutkan.' });
  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] });
  } catch {
    return res.status(401).json({ code: 'INVALID_SESSION', message: 'Token tidak valid atau sudah kedaluwarsa.' });
  }
  const { rows } = await db.query('SELECT id, name, email, role FROM users WHERE id = $1', [decoded.id]);
  if (!rows[0]) return res.status(401).json({ code: 'INVALID_SESSION', message: 'Sesi tidak valid. Silakan masuk kembali.' });
  req.user = rows[0];
  next();
}
module.exports = { authenticate };
