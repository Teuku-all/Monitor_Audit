const jwt = require('jsonwebtoken');

const COOKIE_NAME = 'audit_session';
const ISSUER = 'audit-monitor';
const AUDIENCE = 'audit-monitor-web';

function sessionSeconds() {
  const hours = Number(process.env.SESSION_HOURS || 4);
  return Number.isFinite(hours) && hours >= 1 && hours <= 24 ? Math.floor(hours * 3600) : 14400;
}

function createToken(user) {
  return jwt.sign(
    { role: user.role },
    process.env.JWT_SECRET,
    { subject: String(user.id), issuer: ISSUER, audience: AUDIENCE, expiresIn: sessionSeconds(), algorithm: 'HS256' },
  );
}

function cookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: sessionSeconds() * 1000,
  };
}

function setSessionCookie(res, token) {
  res.cookie(COOKIE_NAME, token, cookieOptions());
}

function clearSessionCookie(res) {
  res.clearCookie(COOKIE_NAME, { ...cookieOptions(), maxAge: undefined });
}

function readSessionCookie(header = '') {
  for (const part of header.split(';')) {
    const [name, ...value] = part.trim().split('=');
    if (name === COOKIE_NAME) return decodeURIComponent(value.join('='));
  }
  return '';
}

function verifyToken(token) {
  return jwt.verify(token, process.env.JWT_SECRET, {
    algorithms: ['HS256'],
    issuer: ISSUER,
    audience: AUDIENCE,
  });
}

module.exports = { createToken, setSessionCookie, clearSessionCookie, readSessionCookie, verifyToken };
