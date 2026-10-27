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
    CREATE TABLE IF NOT EXISTS audit_programs (
      id SERIAL PRIMARY KEY,
      title TEXT NOT NULL,
      period TEXT NOT NULL DEFAULT '',
      start_date DATE NOT NULL,
      due_date DATE NOT NULL,
      standard_workdays INTEGER NOT NULL DEFAULT 45 CHECK(standard_workdays BETWEEN 1 AND 260),
      baseline_on_time_rate NUMERIC(5,2) CHECK(baseline_on_time_rate BETWEEN 0 AND 100),
      baseline_first_pass_rate NUMERIC(5,2) CHECK(baseline_first_pass_rate BETWEEN 0 AND 100),
      created_by INTEGER NOT NULL REFERENCES users(id),
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS audit_engagements (
      id SERIAL PRIMARY KEY,
      program_id INTEGER NOT NULL REFERENCES audit_programs(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      start_date DATE NOT NULL,
      due_date DATE NOT NULL,
      completed_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS targets (
      id SERIAL PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      assigned_to INTEGER NOT NULL REFERENCES users(id),
      created_by INTEGER NOT NULL REFERENCES users(id),
      due_date DATE NOT NULL,
      priority TEXT NOT NULL DEFAULT 'medium' CHECK(priority IN ('low', 'medium', 'high', 'critical')),
      status TEXT NOT NULL DEFAULT 'assigned' CHECK(status IN ('assigned', 'in_progress', 'submitted', 'completed', 'revision')),
      progress INTEGER NOT NULL DEFAULT 0 CHECK(progress BETWEEN 0 AND 100),
      note TEXT NOT NULL DEFAULT '',
      feedback TEXT NOT NULL DEFAULT '',
      start_date DATE NOT NULL DEFAULT CURRENT_DATE,
      reviewer TEXT NOT NULL DEFAULT '',
      audit_status TEXT NOT NULL DEFAULT 'Belum Mulai',
      data_progress INTEGER NOT NULL DEFAULT 0 CHECK(data_progress BETWEEN 0 AND 100),
      analysis_progress INTEGER NOT NULL DEFAULT 0 CHECK(analysis_progress BETWEEN 0 AND 100),
      workpaper_progress INTEGER NOT NULL DEFAULT 0 CHECK(workpaper_progress BETWEEN 0 AND 100),
      blocker TEXT NOT NULL DEFAULT '',
      blocker_impact TEXT NOT NULL DEFAULT '',
      follow_up TEXT NOT NULL DEFAULT '',
      evidence_needed TEXT NOT NULL DEFAULT '',
      engagement_id INTEGER REFERENCES audit_engagements(id),
      completed_at TIMESTAMPTZ,
      review_rounds INTEGER NOT NULL DEFAULT 0,
      quality_procedure_followed BOOLEAN,
      quality_evidence_sufficient BOOLEAN,
      quality_conclusion_reviewed BOOLEAN,
      quality_review_notes TEXT NOT NULL DEFAULT '',
      quality_reviewed_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    ALTER TABLE targets ADD COLUMN IF NOT EXISTS start_date DATE NOT NULL DEFAULT CURRENT_DATE;
    ALTER TABLE targets ADD COLUMN IF NOT EXISTS reviewer TEXT NOT NULL DEFAULT '';
    ALTER TABLE targets ADD COLUMN IF NOT EXISTS audit_status TEXT NOT NULL DEFAULT 'Belum Mulai';
    ALTER TABLE targets ADD COLUMN IF NOT EXISTS data_progress INTEGER NOT NULL DEFAULT 0;
    ALTER TABLE targets ADD COLUMN IF NOT EXISTS analysis_progress INTEGER NOT NULL DEFAULT 0;
    ALTER TABLE targets ADD COLUMN IF NOT EXISTS workpaper_progress INTEGER NOT NULL DEFAULT 0;
    ALTER TABLE targets ADD COLUMN IF NOT EXISTS blocker TEXT NOT NULL DEFAULT '';
    ALTER TABLE targets ADD COLUMN IF NOT EXISTS blocker_impact TEXT NOT NULL DEFAULT '';
    ALTER TABLE targets ADD COLUMN IF NOT EXISTS follow_up TEXT NOT NULL DEFAULT '';
    ALTER TABLE targets ADD COLUMN IF NOT EXISTS evidence_needed TEXT NOT NULL DEFAULT '';
    ALTER TABLE targets ADD COLUMN IF NOT EXISTS engagement_id INTEGER REFERENCES audit_engagements(id);
    ALTER TABLE targets ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;
    ALTER TABLE targets ADD COLUMN IF NOT EXISTS review_rounds INTEGER NOT NULL DEFAULT 0;
    ALTER TABLE targets ADD COLUMN IF NOT EXISTS quality_procedure_followed BOOLEAN;
    ALTER TABLE targets ADD COLUMN IF NOT EXISTS quality_evidence_sufficient BOOLEAN;
    ALTER TABLE targets ADD COLUMN IF NOT EXISTS quality_conclusion_reviewed BOOLEAN;
    ALTER TABLE targets ADD COLUMN IF NOT EXISTS quality_review_notes TEXT NOT NULL DEFAULT '';
    ALTER TABLE targets ADD COLUMN IF NOT EXISTS quality_reviewed_at TIMESTAMPTZ;
    ALTER TABLE targets DROP CONSTRAINT IF EXISTS targets_priority_check;
    ALTER TABLE targets ADD CONSTRAINT targets_priority_check CHECK(priority IN ('low', 'medium', 'high', 'critical'));
    CREATE TABLE IF NOT EXISTS submissions (
      id SERIAL PRIMARY KEY,
      member_id INTEGER NOT NULL REFERENCES users(id),
      title TEXT NOT NULL,
      description TEXT,
      file_path TEXT NOT NULL,
      file_name TEXT NOT NULL,
      file_public_id TEXT,
      file_resource_type TEXT,
      file_format TEXT,
      status TEXT NOT NULL DEFAULT 'Menunggu' CHECK(status IN ('Menunggu', 'Disetujui', 'Perlu Revisi')),
      submitted_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      target_id INTEGER REFERENCES targets(id)
    );
    ALTER TABLE submissions ADD COLUMN IF NOT EXISTS target_id INTEGER REFERENCES targets(id);
    ALTER TABLE submissions ADD COLUMN IF NOT EXISTS file_public_id TEXT;
    ALTER TABLE submissions ADD COLUMN IF NOT EXISTS file_resource_type TEXT;
    ALTER TABLE submissions ADD COLUMN IF NOT EXISTS file_format TEXT;
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
    CREATE TABLE IF NOT EXISTS coaching_sessions (
      id SERIAL PRIMARY KEY,
      target_id INTEGER NOT NULL REFERENCES targets(id) ON DELETE CASCADE,
      coach_id INTEGER NOT NULL REFERENCES users(id),
      coaching_date DATE NOT NULL DEFAULT CURRENT_DATE,
      progress_at_coaching INTEGER NOT NULL DEFAULT 0 CHECK(progress_at_coaching BETWEEN 0 AND 100),
      issue TEXT NOT NULL DEFAULT '',
      guidance TEXT NOT NULL DEFAULT '',
      follow_up TEXT NOT NULL DEFAULT '',
      due_date DATE,
      status TEXT NOT NULL DEFAULT 'Belum Mulai' CHECK(status IN ('Belum Mulai', 'Berjalan', 'Menunggu', 'Terhambat', 'Selesai')),
      next_review DATE,
      notes TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS target_progress_history (
      id SERIAL PRIMARY KEY,
      target_id INTEGER NOT NULL REFERENCES targets(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id),
      progress INTEGER NOT NULL CHECK(progress BETWEEN 0 AND 100),
      audit_status TEXT NOT NULL,
      data_progress INTEGER NOT NULL DEFAULT 0,
      analysis_progress INTEGER NOT NULL DEFAULT 0,
      workpaper_progress INTEGER NOT NULL DEFAULT 0,
      note TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS auditee_data_requests (
      id SERIAL PRIMARY KEY,
      target_id INTEGER NOT NULL REFERENCES targets(id) ON DELETE CASCADE,
      created_by INTEGER NOT NULL REFERENCES users(id),
      requested_item TEXT NOT NULL,
      auditee_pic TEXT NOT NULL,
      requested_at DATE NOT NULL,
      due_date DATE NOT NULL,
      received_at DATE,
      verified_at DATE,
      status TEXT NOT NULL DEFAULT 'requested' CHECK(status IN ('requested', 'received', 'verified', 'rejected')),
      follow_up TEXT NOT NULL DEFAULT '',
      escalated_at TIMESTAMPTZ,
      handover_at TIMESTAMPTZ,
      handover_note TEXT NOT NULL DEFAULT '',
      updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS target_work_logs (
      id SERIAL PRIMARY KEY,
      target_id INTEGER NOT NULL REFERENCES targets(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id),
      work_date DATE NOT NULL DEFAULT CURRENT_DATE,
      hours NUMERIC(5,2) NOT NULL CHECK(hours > 0 AND hours <= 24),
      note TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS targets_assignee ON targets(assigned_to, status);
    CREATE INDEX IF NOT EXISTS targets_engagement ON targets(engagement_id, status);
    CREATE INDEX IF NOT EXISTS engagements_program ON audit_engagements(program_id, due_date);
    CREATE INDEX IF NOT EXISTS progress_history_target_date ON target_progress_history(target_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS data_requests_target_due ON auditee_data_requests(target_id, due_date, status);
    CREATE INDEX IF NOT EXISTS work_logs_target_date ON target_work_logs(target_id, work_date DESC);
    CREATE INDEX IF NOT EXISTS comments_submission ON comments(submission_id);
    CREATE INDEX IF NOT EXISTS replies_comment ON comment_replies(comment_id);
    CREATE INDEX IF NOT EXISTS coaching_target ON coaching_sessions(target_id, coaching_date DESC);
  `);

  const adminEmail = (process.env.ADMIN_EMAIL || 'admin@audit.com').trim().toLowerCase();
  const { rows } = await db.query('SELECT id FROM users WHERE lower(email) = $1', [adminEmail]);
  if (!rows.length) {
    const adminPassword = process.env.ADMIN_PASSWORD || (process.env.NODE_ENV !== 'production' ? 'admin123' : '');
    if (adminPassword) {
      await db.query(
        'INSERT INTO users (name, email, password, role) VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING',
        ['Admin Utama', adminEmail, await bcrypt.hash(adminPassword, 12), 'admin'],
      );
    }
  }
}

module.exports = { db, initDB };
