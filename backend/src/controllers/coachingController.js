const { db } = require('../config/db');
const STATUSES = ['Belum Mulai', 'Berjalan', 'Menunggu', 'Terhambat', 'Selesai'];
const SELECT = `SELECT c.*, t.title AS target_title, t.assigned_to, u.name AS member_name, a.name AS coach_name
  FROM coaching_sessions c JOIN targets t ON t.id = c.target_id
  JOIN users u ON u.id = t.assigned_to JOIN users a ON a.id = c.coach_id`;
function fail(res, status, code, message) { return res.status(status).json({ code, message }); }
function validDate(value, optional = false) {
  if (optional && (value === '' || value == null)) return true;
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
    && !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
}

async function list(req, res) {
  const params = []; let where = '';
  if (req.user.role === 'member') { params.push(req.user.id); where = ' WHERE t.assigned_to = $1'; }
  const { rows } = await db.query(`${SELECT}${where} ORDER BY c.coaching_date DESC, c.id DESC`, params);
  res.json(rows);
}

async function create(req, res) {
  const { target_id, coaching_date, progress_at_coaching, issue = '', guidance = '', follow_up = '', due_date = null, status = 'Belum Mulai', next_review = null, notes = '' } = req.body;
  const targetId = Number(target_id);
  if (!Number.isInteger(targetId) || targetId < 1) return fail(res, 400, 'INVALID_TARGET', 'Pilih sasaran audit yang valid.');
  if (!validDate(coaching_date) || !validDate(due_date, true) || !validDate(next_review, true)) return fail(res, 400, 'INVALID_DATE', 'Tanggal coaching atau tindak lanjut tidak valid.');
  if (!Number.isInteger(progress_at_coaching) || progress_at_coaching < 0 || progress_at_coaching > 100) return fail(res, 400, 'INVALID_PROGRESS', 'Progres coaching harus 0 sampai 100.');
  if (!STATUSES.includes(status)) return fail(res, 400, 'INVALID_STATUS', 'Status tindak lanjut tidak valid.');
  const fields = [issue, guidance, follow_up, notes];
  if (fields.some(value => typeof value !== 'string') || issue.length > 4000 || guidance.length > 4000 || follow_up.length > 4000 || notes.length > 4000) return fail(res, 400, 'INVALID_TEXT', 'Catatan coaching maksimal 4000 karakter per kolom.');
  const { rows: targets } = await db.query('SELECT id FROM targets WHERE id = $1', [targetId]);
  if (!targets[0]) return fail(res, 404, 'TARGET_NOT_FOUND', 'Sasaran audit tidak ditemukan.');
  const { rows } = await db.query(`INSERT INTO coaching_sessions
    (target_id, coach_id, coaching_date, progress_at_coaching, issue, guidance, follow_up, due_date, status, next_review, notes)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING id`,
  [targetId, req.user.id, coaching_date, progress_at_coaching, issue.trim(), guidance.trim(), follow_up.trim(), due_date || null, status, next_review || null, notes.trim()]);
  const result = await db.query(`${SELECT} WHERE c.id = $1`, [rows[0].id]);
  res.status(201).json(result.rows[0]);
}

async function update(req, res) {
  const { rows } = await db.query(`${SELECT} WHERE c.id = $1`, [req.params.id]);
  const coaching = rows[0];
  if (!coaching) return fail(res, 404, 'COACHING_NOT_FOUND', 'Catatan coaching tidak ditemukan.');
  if (req.user.role !== 'admin' && coaching.assigned_to !== req.user.id) return fail(res, 403, 'FORBIDDEN', 'Akses ditolak.');
  if (req.user.role === 'admin') return fail(res, 403, 'ADMIN_READ_ONLY', 'Administrator membuat catatan coaching baru; tindak lanjut diperbarui oleh PIC.');
  const followUp = typeof req.body.follow_up === 'string' ? req.body.follow_up.trim() : coaching.follow_up;
  const status = req.body.status ?? coaching.status;
  const notes = typeof req.body.notes === 'string' ? req.body.notes.trim() : coaching.notes;
  if (!STATUSES.includes(status) || followUp.length > 4000 || notes.length > 4000) return fail(res, 400, 'INVALID_UPDATE', 'Periksa status dan panjang catatan tindak lanjut.');
  await db.query('UPDATE coaching_sessions SET follow_up = $1, status = $2, notes = $3 WHERE id = $4', [followUp, status, notes, coaching.id]);
  const updated = await db.query(`${SELECT} WHERE c.id = $1`, [coaching.id]);
  res.json(updated.rows[0]);
}

module.exports = { list, create, update };
