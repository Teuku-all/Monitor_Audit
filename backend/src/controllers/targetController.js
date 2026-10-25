const { db } = require('../config/db');
const { normalizeFilename } = require('../utils/normalizeFilename');
const STATUSES = ['assigned', 'in_progress', 'submitted', 'completed', 'revision'];
const SELECT_TARGET = `SELECT t.*, u.name AS assigned_name, u.email AS assigned_email, a.name AS created_by_name
  FROM targets t JOIN users u ON u.id = t.assigned_to JOIN users a ON a.id = t.created_by`;

async function getTarget(id) {
  const { rows } = await db.query(`${SELECT_TARGET} WHERE t.id = $1`, [id]);
  return rows[0];
}
function fail(res, status, code, message) { return res.status(status).json({ code, message }); }
function canAccess(target, user) { return user.role === 'admin' || target.assigned_to === user.id; }

async function listTargets(req, res) {
  const where = [], params = [];
  if (req.user.role === 'member') { params.push(req.user.id); where.push(`t.assigned_to = $${params.length}`); }
  else if (req.query.assigned_to) { params.push(req.query.assigned_to); where.push(`t.assigned_to = $${params.length}`); }
  if (req.query.status && req.query.status !== 'all') {
    if (!STATUSES.includes(req.query.status)) return fail(res, 400, 'INVALID_STATUS', 'Status target tidak valid.');
    params.push(req.query.status); where.push(`t.status = $${params.length}`);
  }
  if (typeof req.query.search === 'string' && req.query.search.trim()) {
    const search = `%${req.query.search.trim()}%`;
    params.push(search, search);
    where.push(`(t.title ILIKE $${params.length - 1} OR u.name ILIKE $${params.length})`);
  }
  const { rows } = await db.query(
    `${SELECT_TARGET}${where.length ? ` WHERE ${where.join(' AND ')}` : ''} ORDER BY t.created_at DESC, t.id DESC`,
    params,
  );
  res.json(rows);
}

async function targetDetail(req, res) {
  const target = await getTarget(req.params.id);
  if (!target) return fail(res, 404, 'TARGET_NOT_FOUND', 'Target tidak ditemukan.');
  if (!canAccess(target, req.user)) return fail(res, 403, 'FORBIDDEN', 'Akses ditolak.');
  const { rows } = await db.query(
    'SELECT id, title, file_name, status, submitted_at FROM submissions WHERE target_id = $1 ORDER BY submitted_at DESC',
    [target.id],
  );
  const submissions = rows.map(submission => ({ ...submission, file_name: normalizeFilename(submission.file_name) }));
  res.json({ ...target, submissions });
}

async function createTarget(req, res) {
  const { assigned_to, due_date, priority = 'medium' } = req.body;
  const title = typeof req.body.title === 'string' ? req.body.title.trim() : '';
  const description = typeof req.body.description === 'string' ? req.body.description.trim() : '';
  if (!title || title.length > 200 || description.length > 5000) return fail(res, 400, 'INVALID_TARGET', 'Judul wajib diisi (maksimal 200 karakter), deskripsi maksimal 5000 karakter.');
  if (!Number.isInteger(Number(assigned_to)) || Number(assigned_to) <= 0) return fail(res, 400, 'INVALID_ASSIGNEE', 'Pilih member untuk target ini.');
  if (!['low', 'medium', 'high'].includes(priority)) return fail(res, 400, 'INVALID_PRIORITY', 'Prioritas tidak valid.');
  if (typeof due_date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(due_date) || Number.isNaN(Date.parse(due_date)) || new Date(due_date).toISOString().slice(0, 10) !== due_date) return fail(res, 400, 'INVALID_DATE', 'Tanggal tenggat tidak valid.');
  const { rows: members } = await db.query("SELECT id FROM users WHERE id = $1 AND role = 'member'", [Number(assigned_to)]);
  if (!members[0]) return fail(res, 400, 'INVALID_ASSIGNEE', 'Member tidak ditemukan.');
  const { rows } = await db.query(
    'INSERT INTO targets (title, description, assigned_to, created_by, due_date, priority) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id',
    [title, description, members[0].id, req.user.id, due_date, priority],
  );
  res.status(201).json(await getTarget(rows[0].id));
}

async function updateProgress(req, res) {
  const target = await getTarget(req.params.id);
  if (!target) return fail(res, 404, 'TARGET_NOT_FOUND', 'Target tidak ditemukan.');
  if (target.assigned_to !== req.user.id) return fail(res, 403, 'FORBIDDEN', 'Akses ditolak.');
  if (['completed', 'submitted'].includes(target.status)) return fail(res, 409, 'TARGET_LOCKED', 'Target sudah selesai atau sedang menunggu review.');
  const { progress } = req.body;
  const note = typeof req.body.note === 'string' ? req.body.note.trim() : '';
  if (!Number.isInteger(progress) || progress < 0 || progress > 100 || note.length > 4000) return fail(res, 400, 'INVALID_PROGRESS', 'Progres harus 0 sampai 100; catatan maksimal 4000 karakter.');
  await db.query(
    'UPDATE targets SET progress = $1, note = $2, status = $3, updated_at = CURRENT_TIMESTAMP WHERE id = $4',
    [progress, note, progress === 100 ? 'submitted' : 'in_progress', target.id],
  );
  res.json(await getTarget(target.id));
}

async function reviewTarget(req, res) {
  const target = await getTarget(req.params.id);
  if (!target) return fail(res, 404, 'TARGET_NOT_FOUND', 'Target tidak ditemukan.');
  if (target.status !== 'submitted') return fail(res, 409, 'NOT_READY_FOR_REVIEW', 'Target belum dikirim untuk direview.');
  const { status } = req.body;
  const feedback = typeof req.body.feedback === 'string' ? req.body.feedback.trim() : '';
  if (!['completed', 'revision'].includes(status) || feedback.length > 4000 || (status === 'revision' && !feedback)) return fail(res, 400, 'INVALID_REVIEW', 'Pilih hasil review dan isi catatan revisi bila diperlukan.');
  await db.query('UPDATE targets SET status = $1, feedback = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3', [status, feedback, target.id]);
  res.json(await getTarget(target.id));
}

module.exports = { listTargets, targetDetail, createTarget, updateProgress, reviewTarget };
