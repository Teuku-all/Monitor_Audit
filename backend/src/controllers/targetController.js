const { db } = require('../config/db');
const { normalizeFilename } = require('../utils/normalizeFilename');
const STATUSES = ['assigned', 'in_progress', 'submitted', 'completed', 'revision'];
const AUDIT_STATUSES = ['Belum Mulai', 'Berjalan', 'Menunggu Data', 'Terhambat', 'Review Ketua Tim', 'Selesai'];
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
  const { assigned_to, due_date, start_date, priority = 'medium' } = req.body;
  const reviewer = typeof req.body.reviewer === 'string' ? req.body.reviewer.trim() : '';
  const evidenceNeeded = typeof req.body.evidence_needed === 'string' ? req.body.evidence_needed.trim() : '';
  const title = typeof req.body.title === 'string' ? req.body.title.trim() : '';
  const description = typeof req.body.description === 'string' ? req.body.description.trim() : '';
  if (!title || title.length > 200 || description.length > 5000) return fail(res, 400, 'INVALID_TARGET', 'Judul wajib diisi (maksimal 200 karakter), deskripsi maksimal 5000 karakter.');
  if (!Number.isInteger(Number(assigned_to)) || Number(assigned_to) <= 0) return fail(res, 400, 'INVALID_ASSIGNEE', 'Pilih member untuk target ini.');
  if (!['low', 'medium', 'high', 'critical'].includes(priority)) return fail(res, 400, 'INVALID_PRIORITY', 'Prioritas tidak valid.');
  if (typeof due_date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(due_date) || Number.isNaN(Date.parse(due_date)) || new Date(due_date).toISOString().slice(0, 10) !== due_date) return fail(res, 400, 'INVALID_DATE', 'Tanggal tenggat tidak valid.');
  if (start_date && (typeof start_date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(start_date) || Number.isNaN(Date.parse(start_date)) || new Date(start_date).toISOString().slice(0, 10) !== start_date)) return fail(res, 400, 'INVALID_START_DATE', 'Tanggal mulai tidak valid.');
  if (start_date && start_date > due_date) return fail(res, 400, 'INVALID_DATE_RANGE', 'Tanggal mulai tidak boleh setelah tanggal target selesai.');
  if (reviewer.length > 200 || evidenceNeeded.length > 3000) return fail(res, 400, 'INVALID_REVIEWER', 'Nama reviewer maksimal 200 karakter dan kebutuhan bukti maksimal 3000 karakter.');
  const { rows: members } = await db.query("SELECT id FROM users WHERE id = $1 AND role = 'member'", [Number(assigned_to)]);
  if (!members[0]) return fail(res, 400, 'INVALID_ASSIGNEE', 'Member tidak ditemukan.');
  const { rows } = await db.query(
    'INSERT INTO targets (title, description, assigned_to, created_by, due_date, priority, start_date, reviewer, evidence_needed) VALUES ($1, $2, $3, $4, $5, $6, COALESCE($7::date, CURRENT_DATE), $8, $9) RETURNING id',
    [title, description, members[0].id, req.user.id, due_date, priority, start_date || null, reviewer, evidenceNeeded],
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
  const auditStatus = progress === 100 ? 'Review Ketua Tim' : (req.body.audit_status ?? (progress > 0 ? 'Berjalan' : target.audit_status));
  const stages = ['data_progress', 'analysis_progress', 'workpaper_progress'];
  const stageValues = stages.map(key => req.body[key] ?? target[key]);
  const textFields = ['blocker', 'blocker_impact', 'follow_up', 'evidence_needed'];
  const textValues = textFields.map(key => req.body[key] ?? target[key] ?? '');
  if (!AUDIT_STATUSES.includes(auditStatus)) return fail(res, 400, 'INVALID_AUDIT_STATUS', 'Status audit tidak valid.');
  if (stageValues.some(value => !Number.isInteger(value) || value < 0 || value > 100)) return fail(res, 400, 'INVALID_STAGE_PROGRESS', 'Progres setiap tahap harus 0 sampai 100.');
  if (textValues.some((value, i) => typeof value !== 'string' || value.trim().length > [3000, 3000, 3000, 3000][i])) return fail(res, 400, 'INVALID_AUDIT_NOTES', 'Rincian kendala, dampak, tindak lanjut, dan bukti maksimal 3000 karakter.');
  if (auditStatus === 'Terhambat' && !textValues[0].trim()) return fail(res, 400, 'BLOCKER_REQUIRED', 'Jelaskan kendala utama saat status Terhambat.');
  if (auditStatus === 'Selesai' && progress < 100) return fail(res, 400, 'AUDIT_NOT_COMPLETE', 'Status selesai memerlukan progres keseluruhan 100%.');
  await db.query(
    `UPDATE targets SET progress = $1, note = $2, status = $3, audit_status = $4,
      data_progress = $5, analysis_progress = $6, workpaper_progress = $7,
      blocker = $8, blocker_impact = $9, follow_up = $10, evidence_needed = $11,
      updated_at = CURRENT_TIMESTAMP WHERE id = $12`,
    [progress, note, progress === 100 ? 'submitted' : 'in_progress', auditStatus, ...stageValues, ...textValues.map(value => value.trim()), target.id],
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
  await db.query("UPDATE targets SET status = $1, audit_status = $2, feedback = $3, updated_at = CURRENT_TIMESTAMP WHERE id = $4", [status, status === 'completed' ? 'Selesai' : 'Berjalan', feedback, target.id]);
  res.json(await getTarget(target.id));
}

module.exports = { listTargets, targetDetail, createTarget, updateProgress, reviewTarget };
