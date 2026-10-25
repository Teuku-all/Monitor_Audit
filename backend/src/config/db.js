const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');

const backendRoot = path.resolve(__dirname, '../..');
const configuredPath = process.env.DB_PATH || './src/config/database.db';
const dbPath = configuredPath === ':memory:' ? configuredPath : path.resolve(backendRoot, configuredPath);
if (dbPath !== ':memory:') fs.mkdirSync(path.dirname(dbPath), { recursive: true });
const db = new Database(dbPath);
db.pragma('foreign_keys = ON');
db.pragma('journal_mode = WAL');
db.pragma('busy_timeout = 5000');

function initDB() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      role TEXT CHECK(role IN ('admin', 'member')) NOT NULL DEFAULT 'member',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS targets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      assigned_to INTEGER NOT NULL REFERENCES users(id),
      created_by INTEGER NOT NULL REFERENCES users(id),
      due_date TEXT NOT NULL,
      priority TEXT NOT NULL DEFAULT 'medium' CHECK(priority IN ('low', 'medium', 'high')),
      status TEXT NOT NULL DEFAULT 'assigned' CHECK(status IN ('assigned', 'in_progress', 'submitted', 'completed', 'revision')),
      progress INTEGER NOT NULL DEFAULT 0 CHECK(progress BETWEEN 0 AND 100),
      note TEXT NOT NULL DEFAULT '',
      feedback TEXT NOT NULL DEFAULT '',
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS submissions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      member_id INTEGER NOT NULL REFERENCES users(id),
      title TEXT NOT NULL,
      description TEXT,
      file_path TEXT NOT NULL,
      file_name TEXT NOT NULL,
      status TEXT DEFAULT 'Menunggu' CHECK(status IN ('Menunggu', 'Disetujui', 'Perlu Revisi')),
      submitted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      target_id INTEGER REFERENCES targets(id)
    );
    CREATE TABLE IF NOT EXISTS comments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      submission_id INTEGER NOT NULL REFERENCES submissions(id),
      admin_id INTEGER NOT NULL REFERENCES users(id),
      body TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS comment_replies (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      comment_id INTEGER NOT NULL REFERENCES comments(id),
      user_id INTEGER NOT NULL REFERENCES users(id),
      body TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS targets_assignee ON targets(assigned_to, status);
    CREATE INDEX IF NOT EXISTS comments_submission ON comments(submission_id);
    CREATE INDEX IF NOT EXISTS replies_comment ON comment_replies(comment_id);
  `);
  // Additive migration: preserve existing accounts, documents, comments and replies.
  if (!db.prepare('PRAGMA table_info(submissions)').all().some(column => column.name === 'target_id')) {
    db.exec('ALTER TABLE submissions ADD COLUMN target_id INTEGER REFERENCES targets(id)');
  }
  const adminEmail = (process.env.ADMIN_EMAIL || 'admin@audit.com').trim().toLowerCase();
  const adminExists = db.prepare('SELECT id FROM users WHERE lower(email) = ?').get(adminEmail);
  if (!adminExists) {
    const adminPassword = process.env.ADMIN_PASSWORD || (process.env.NODE_ENV !== 'production' ? 'admin123' : '');
    if (adminPassword) {
      db.prepare('INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)').run(
        'Admin Utama', adminEmail, bcrypt.hashSync(adminPassword, 10), 'admin'
      );
    }
  }
}

module.exports = { db, initDB, dbPath };
