const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { db } = require('../config/db');

function register(req, res) {
  const { name, email, password } = req.body;
  const cleanName = typeof name === 'string' ? name.trim() : '';
  const cleanEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';

  if (!cleanName || !cleanEmail || typeof password !== 'string' || !password) {
    return res.status(400).json({ message: 'Nama, email, dan password wajib diisi.' });
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
    return res.status(400).json({ message: 'Format email tidak valid.' });
  }
  if (password.length < 8) {
    return res.status(400).json({ message: 'Password harus terdiri dari minimal 8 karakter.' });
  }

  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(cleanEmail);
  if (existing) {
    return res.status(409).json({ message: 'Email sudah terdaftar.' });
  }

  const hashed = bcrypt.hashSync(password, 10);

  const result = db.prepare(
    'INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)'
  ).run(cleanName, cleanEmail, hashed, 'member');

  res.status(201).json({ message: 'Registrasi berhasil.', userId: result.lastInsertRowid });
}

function login(req, res) {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: 'Email dan password wajib diisi.' });
  }

  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  if (!user) {
    return res.status(401).json({ message: 'Email atau password salah.' });
  }

  const valid = bcrypt.compareSync(password, user.password);
  if (!valid) {
    return res.status(401).json({ message: 'Email atau password salah.' });
  }

  const token = jwt.sign(
    { id: user.id, name: user.name, email: user.email, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );

  res.json({
    message: 'Login berhasil.',
    token,
    user: { id: user.id, name: user.name, email: user.email, role: user.role },
  });
}

function getProfile(req, res) {
  const user = db.prepare('SELECT id, name, email, role, created_at FROM users WHERE id = ?').get(req.user.id);
  if (!user) return res.status(404).json({ message: 'User tidak ditemukan.' });
  res.json(user);
}

module.exports = { register, login, getProfile };
