const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { OAuth2Client } = require('google-auth-library');
const { db } = require('../config/db');

function createSession(user) {
  const token = jwt.sign(
    { id: user.id, name: user.name, email: user.email, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: '7d', algorithm: 'HS256' },
  );
  return { token, user: { id: user.id, name: user.name, email: user.email, role: user.role } };
}

async function register(req, res) {
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

  try {
    const { rows } = await db.query(
      'INSERT INTO users (name, email, password, role) VALUES ($1, $2, $3, $4) RETURNING id',
      [cleanName, cleanEmail, bcrypt.hashSync(password, 10), 'member'],
    );
    res.status(201).json({ message: 'Registrasi berhasil.', userId: rows[0].id });
  } catch (error) {
    if (error.code === '23505') return res.status(409).json({ code: 'EMAIL_EXISTS', message: 'Email sudah terdaftar.' });
    throw error;
  }
}

async function login(req, res) {
  const email = typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  const password = req.body.password;
  if (!email || typeof password !== 'string' || !password || Buffer.byteLength(password, 'utf8') > 72) {
    return res.status(400).json({ code: 'INVALID_LOGIN', message: 'Email dan password wajib diisi.' });
  }
  const { rows } = await db.query('SELECT * FROM users WHERE lower(email) = $1', [email]);
  const user = rows[0];
  if (!user || !user.password || !bcrypt.compareSync(password, user.password)) {
    return res.status(401).json({ code: 'INVALID_CREDENTIALS', message: 'Email atau password salah.' });
  }
  res.json({ message: 'Login berhasil.', ...createSession(user) });
}

async function googleLogin(req, res) {
  const credential = typeof req.body.credential === 'string' ? req.body.credential : '';
  if (!credential) return res.status(400).json({ code: 'INVALID_GOOGLE_CREDENTIAL', message: 'Kredensial Google wajib diisi.' });
  if (!process.env.GOOGLE_CLIENT_ID) {
    return res.status(503).json({ code: 'GOOGLE_LOGIN_UNAVAILABLE', message: 'Login Google belum dikonfigurasi.' });
  }

  let payload;
  try {
    const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
    const ticket = await client.verifyIdToken({ idToken: credential, audience: process.env.GOOGLE_CLIENT_ID });
    payload = ticket.getPayload();
  } catch {
    return res.status(401).json({ code: 'INVALID_GOOGLE_CREDENTIAL', message: 'Kredensial Google tidak valid.' });
  }
  if (!payload?.sub || !payload.email || payload.email_verified !== true) {
    return res.status(401).json({ code: 'UNVERIFIED_GOOGLE_ACCOUNT', message: 'Akun Google harus memiliki email terverifikasi.' });
  }

  const email = payload.email.trim().toLowerCase();
  let { rows } = await db.query('SELECT id, name, email, role, google_sub FROM users WHERE google_sub = $1', [payload.sub]);
  let user = rows[0];
  if (!user) {
    ({ rows } = await db.query('SELECT id, name, email, role, google_sub FROM users WHERE lower(email) = $1', [email]));
    user = rows[0];
    if (user?.google_sub && user.google_sub !== payload.sub) {
      return res.status(409).json({ code: 'GOOGLE_ACCOUNT_LINKED', message: 'Email ini sudah terhubung ke akun Google lain.' });
    }

    try {
      if (user) {
        ({ rows } = await db.query(
          'UPDATE users SET google_sub = $1 WHERE id = $2 RETURNING id, name, email, role',
          [payload.sub, user.id],
        ));
      } else {
        ({ rows } = await db.query(
          "INSERT INTO users (name, email, google_sub, role) VALUES ($1, $2, $3, 'member') RETURNING id, name, email, role",
          [payload.name?.trim() || email.split('@')[0], email, payload.sub],
        ));
      }
      user = rows[0];
    } catch (error) {
      if (error.code === '23505') {
        return res.status(409).json({ code: 'GOOGLE_ACCOUNT_LINKED', message: 'Akun Google sudah terhubung ke akun lain.' });
      }
      throw error;
    }
  }

  res.json({ message: 'Login Google berhasil.', ...createSession(user) });
}

async function getProfile(req, res) {
  const { rows } = await db.query('SELECT id, name, email, role, created_at FROM users WHERE id = $1', [req.user.id]);
  if (!rows[0]) return res.status(404).json({ message: 'User tidak ditemukan.' });
  res.json(rows[0]);
}

module.exports = { register, login, googleLogin, getProfile };
