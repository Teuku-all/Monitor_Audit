const jwt = require('jsonwebtoken');
const { db } = require('../config/db');

function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  const token = typeof authHeader === 'string' && authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  if (!token) return res.status(401).json({ code: 'AUTH_REQUIRED', message: 'Silakan masuk untuk melanjutkan.' });
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] });
    const user = db.prepare('SELECT id, name, email, role FROM users WHERE id = ?').get(decoded.id);
    if (!user) return res.status(401).json({ code: 'INVALID_SESSION', message: 'Sesi tidak valid. Silakan masuk kembali.' });
    req.user = user;
    next();
  } catch {
    return res.status(401).json({ code: 'INVALID_SESSION', message: 'Token tidak valid atau sudah kedaluwarsa.' });
  }
}
module.exports = { authenticate };
