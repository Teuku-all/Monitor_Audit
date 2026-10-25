const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { db } = require('../config/db');

function register(req, res) {
  const { name, email, password } = req.body;
  const cleanName = typeof name === 'string' ? name.trim() : '';
  const cleanEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
  if (!cleanName || cleanName.length > 100 || !cleanEmail || typeof password !== 'string' || !password) {
    return res.status(400).json({ code: 'INVALID_REGISTRATION', message: 'Nama (maksimal 100 karakter), email, dan password wajib diisi.' });
  }
  if (cleanEmail.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
    return res.status(400).json({ code: 'INVALID_EMAIL', message: 'Format email tidak valid.' });
  }
  if (password.length < 8 || Buffer.byteLength(password, 'utf8') > 72) {
    return res.status(400).json({ code: 'INVALID_PASSWORD', message: 'Password minimal 8 karakter dan maksimal 72 byte.' });
  }
  const existing = db.prepare('SELECT id FROM users WHERE lower(email) = ?').get(cleanEmail);
  if (existing) return res.status(409).json({ code: 'EMAIL_EXISTS', message: 'Email sudah terdaftar.' });
  const hashed = bcrypt.hashSync(password, 10);
  try {
    const result = db.prepare('INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)').run(cleanName, cleanEmail, hashed, 'member');
    res.status(201).json({ message: 'Registrasi berhasil.', userId: result.lastInsertRowid });
  } catch (error) {
    if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') return res.status(409).json({ code: 'EMAIL_EXISTS', message: 'Email sudah terdaftar.' });
    throw error;
  }
}
function login(req, res) {
  const email = typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  const password = req.body.password;
  if (!email || typeof password !== 'string' || !password || Buffer.byteLength(password, 'utf8') > 72) return res.status(400).json({ code: 'INVALID_LOGIN', message: 'Email dan password wajib diisi.' });
  const user = db.prepare('SELECT * FROM users WHERE lower(email) = ?').get(email);
  if (!user || !bcrypt.compareSync(password, user.password)) return res.status(401).json({ code: 'INVALID_CREDENTIALS', message: 'Email atau password salah.' });
  const token = jwt.sign({ id: user.id, name: user.name, email: user.email, role: user.role }, process.env.JWT_SECRET, { expiresIn: '7d', algorithm: 'HS256' });
  res.json({ message: 'Login berhasil.', token, user: { id: user.id, name: user.name, email: user.email, role: user.role } });
}
function getProfile(req, res) {
  const user = db.prepare('SELECT id, name, email, role, created_at FROM users WHERE id = ?').get(req.user.id);
  if (!user) return res.status(404).json({ message: 'User tidak ditemukan.' });
  res.json(user);
}
module.exports = { register, login, getProfile };
