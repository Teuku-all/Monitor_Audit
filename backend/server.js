const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const express = require('express');
const cors = require('cors');
const { initDB } = require('./src/config/db');

if (!process.env.JWT_SECRET) throw new Error('JWT_SECRET is required. Copy backend/.env.example to backend/.env and set a secret.');
const app = express();
app.disable('x-powered-by');
const vercelOrigins = ['VERCEL_URL', 'VERCEL_BRANCH_URL', 'VERCEL_PROJECT_PRODUCTION_URL']
  .map(key => process.env[key])
  .filter(Boolean)
  .map(host => `https://${host}`);
const origins = [
  ...(process.env.CORS_ORIGINS || 'http://localhost:5173,http://127.0.0.1:5173').split(','),
  ...vercelOrigins,
].map(value => value.trim()).filter(Boolean);
app.use(cors({
  origin(origin, callback) {
    if (!origin || origins.includes(origin)) return callback(null, true);
    const error = new Error('Origin tidak diizinkan.'); error.status = 403; callback(error);
  },
  credentials: true,
}));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));
app.use('/api/auth', require('./src/routes/auth'));
app.use('/api/submissions', require('./src/routes/submissions'));
app.use('/api/comments', require('./src/routes/comments'));
app.use('/api/coaching', require('./src/routes/coaching'));
app.use('/api/targets', require('./src/routes/targets'));
app.use('/api/users', require('./src/routes/users'));
app.get('/', (req, res) => res.json({ status: 'Audit Monitor API running', version: '1.1.0' }));
app.use('/api', (req, res) => res.status(404).json({ code: 'NOT_FOUND', message: 'Endpoint tidak ditemukan.' }));
app.use((error, req, res, next) => {
  if (res.headersSent) return next(error);
  const status = error.code === 'LIMIT_FILE_SIZE' ? 413 : error.status || 500;
  if (status === 500) console.error(error.message);
  res.status(status).json({
    code: error.code || 'REQUEST_FAILED',
    message: error.code === 'LIMIT_FILE_SIZE' ? 'Ukuran file maksimal 10 MB.' : status < 500 ? error.message : 'Terjadi kesalahan. Silakan coba lagi.',
  });
});
if (require.main === module) {
  initDB().then(() => {
    const server = app.listen(Number(process.env.PORT || 3001), () => {
      console.log(`Server running at http://localhost:${server.address().port}`);
      if (process.send) process.send({ port: server.address().port });
    });
    process.on('SIGTERM', () => server.close(() => process.exit(0)));
  }).catch(error => {
    console.error(`Database initialization failed: ${error.message}`);
    process.exitCode = 1;
  });
}
module.exports = { app };
