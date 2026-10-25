const { Pool, neonConfig } = require('@neondatabase/serverless');
const bcrypt = require('bcryptjs');

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is required. Set it to your Neon connection string.');
}

if (typeof globalThis.WebSocket === 'undefined') {
  neonConfig.webSocketConstructor = require('ws');
}

const db = new Pool({
  connectionString: process.env.DATABASE_URL,
});
db.on('error', error => console.error(`Unexpected Neon pool error: ${error.message}`));

async function initDB() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password TEXT,
      google_sub TEXT UNIQUE,
      role TEXT NOT NULL DEFAULT 'member' CHECK(role IN ('admin', 'member')),
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    ALTER TABLE users ADD COLUMN IF NOT EXISTS google_sub TEXT UNIQUE;
    ALTER TABLE users ALTER COLUMN password DROP NOT NULL;
    CREATE UNIQUE INDEX IF NOT EXISTS users_email_lower_idx ON users (lower(email));
    CREATE TABLE IF NOT EXISTS targets (
      id SERIAL PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      assigned_to INTEGER NOT NULL REFERENCES users(id),
      created_by INTEGER NOT NULL REFERENCES users(id),
      due_date DATE NOT NULL,
      priority TEXT NOT NULL DEFAULT 'medium' CHECK(priority IN ('low', 'medium', 'high')),
      status TEXT NOT NULL DEFAULT 'assigned' CHECK(status IN ('assigned', 'in_progress', 'submitted', 'completed', 'revision')),
      progress INTEGER NOT NULL DEFAULT 0 CHECK(progress BETWEEN 0 AND 100),
      note TEXT NOT NULL DEFAULT '',
      feedback TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS submissions (
      id SERIAL PRIMARY KEY,
      member_id INTEGER NOT NULL REFERENCES users(id),
      title TEXT NOT NULL,
      description TEXT,
      file_path TEXT NOT NULL,
      file_name TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'Menunggu' CHECK(status IN ('Menunggu', 'Disetujui', 'Perlu Revisi')),
      submitted_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      target_id INTEGER REFERENCES targets(id)
    );
    ALTER TABLE submissions ADD COLUMN IF NOT EXISTS target_id INTEGER REFERENCES targets(id);
    CREATE TABLE IF NOT EXISTS comments (
      id SERIAL PRIMARY KEY,
      submission_id INTEGER NOT NULL REFERENCES submissions(id),
      admin_id INTEGER NOT NULL REFERENCES users(id),
      body TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS comment_replies (
      id SERIAL PRIMARY KEY,
      comment_id INTEGER NOT NULL REFERENCES comments(id),
      user_id INTEGER NOT NULL REFERENCES users(id),
      body TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS targets_assignee ON targets(assigned_to, status);
    CREATE INDEX IF NOT EXISTS comments_submission ON comments(submission_id);
    CREATE INDEX IF NOT EXISTS replies_comment ON comment_replies(comment_id);
  `);

  const adminEmail = (process.env.ADMIN_EMAIL || 'admin@audit.com').trim().toLowerCase();
  const { rows } = await db.query('SELECT id FROM users WHERE lower(email) = $1', [adminEmail]);
  if (!rows.length) {
    const adminPassword = process.env.ADMIN_PASSWORD || (process.env.NODE_ENV !== 'production' ? 'admin123' : '');
    if (adminPassword) {
      await db.query(
        'INSERT INTO users (name, email, password, role) VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING',
        ['Admin Utama', adminEmail, bcrypt.hashSync(adminPassword, 10), 'admin'],
      );
    }
  }
}

module.exports = { db, initDB };
