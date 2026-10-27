const { db } = require('../config/db');
const { normalizeFilename } = require('../utils/normalizeFilename');
const { validDate, withScheduleStatus } = require('../utils/auditDates');
const STATUSES = ['assigned', 'in_progress', 'submitted', 'completed', 'revision'];
const AUDIT_STATUSES = ['Belum Mulai', 'Berjalan', 'Menunggu Data', 'Terhambat', 'Review Ketua Tim', 'Selesai'];
const SELECT_TARGET = `SELECT t.*, u.name AS assigned_name, u.email AS assigned_email, a.name AS created_by_name,
  e.title AS engagement_title, e.program_id
  FROM targets t JOIN users u ON u.id = t.assigned_to JOIN users a ON a.id = t.created_by
  LEFT JOIN audit_engagements e ON e.id = t.engagement_id`;

async function getTarget(id) {
  const { rows } = await db.query(`${SELECT_TARGET} WHERE t.id = $1`, [id]);
  return rows[0] ? withScheduleStatus(rows[0]) : rows[0];
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
  res.json(rows.map(withScheduleStatus));
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
  const [{ rows: requests }, { rows: workLogs }, { rows: history }] = await Promise.all([
    db.query('SELECT * FROM auditee_data_requests WHERE target_id = $1 ORDER BY due_date, id', [target.id]),
    db.query(`SELECT w.*, u.name AS member_name FROM target_work_logs w JOIN users u ON u.id = w.user_id
      WHERE w.target_id = $1 ORDER BY w.work_date DESC, w.id DESC`, [target.id]),
    db.query(`SELECT h.*, u.name AS member_name FROM target_progress_history h JOIN users u ON u.id = h.user_id
      WHERE h.target_id = $1 ORDER BY h.created_at DESC LIMIT 20`, [target.id]),
  ]);
  res.json({ ...target, submissions, data_requests: requests, work_logs: workLogs, progress_history: history });
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
  const engagementId = req.body.engagement_id == null || req.body.engagement_id === '' ? null : Number(req.body.engagement_id);
  if (engagementId !== null) {
    if (!Number.isInteger(engagementId) || engagementId < 1) return fail(res, 400, 'INVALID_ENGAGEMENT', 'Pilih judul audit yang valid.');
    const { rows: engagements } = await db.query('SELECT id, start_date, due_date FROM audit_engagements WHERE id = $1', [engagementId]);
    if (!engagements[0]) return fail(res, 404, 'ENGAGEMENT_NOT_FOUND', 'Judul audit tidak ditemukan.');
    const engagementStart = String(engagements[0].start_date).slice(0, 10);
    const engagementDue = String(engagements[0].due_date).slice(0, 10);
    if (start_date && (start_date < engagementStart || start_date > engagementDue)) return fail(res, 400, 'OUTSIDE_ENGAGEMENT_DATES', 'Tanggal mulai target harus berada dalam rentang judul audit.');
    if (due_date < engagementStart || due_date > engagementDue) return fail(res, 400, 'OUTSIDE_ENGAGEMENT_DATES', 'Tenggat target harus berada dalam rentang judul audit.');
  }
  const { rows } = await db.query(
    'INSERT INTO targets (title, description, assigned_to, created_by, due_date, priority, start_date, reviewer, evidence_needed, engagement_id) VALUES ($1, $2, $3, $4, $5, $6, COALESCE($7::date, CURRENT_DATE), $8, $9, $10) RETURNING id',
    [title, description, members[0].id, req.user.id, due_date, priority, start_date || null, reviewer, evidenceNeeded, engagementId],
  );
  res.status(201).json(await getTarget(rows[0].id));
}

async function assignTargetEngagement(req, res) {
  const targetId = Number(req.params.id);
  const engagementId = req.body.engagement_id == null || req.body.engagement_id === '' ? null : Number(req.body.engagement_id);
  if (!Number.isInteger(targetId) || targetId < 1 || (engagementId !== null && (!Number.isInteger(engagementId) || engagementId < 1))) return fail(res, 400, 'INVALID_ID', 'ID sasaran atau judul audit tidak valid.');
  const { rows: targets } = await db.query('SELECT id, start_date, due_date FROM targets WHERE id = $1', [targetId]);
  if (!targets[0]) return fail(res, 404, 'TARGET_NOT_FOUND', 'Target tidak ditemukan.');
  if (engagementId !== null) {
    const { rows: engagements } = await db.query('SELECT start_date, due_date FROM audit_engagements WHERE id = $1', [engagementId]);
    if (!engagements[0]) return fail(res, 404, 'ENGAGEMENT_NOT_FOUND', 'Judul audit tidak ditemukan.');
    const start = String(engagements[0].start_date).slice(0, 10);
    const due = String(engagements[0].due_date).slice(0, 10);
    if (String(targets[0].start_date).slice(0, 10) < start || String(targets[0].due_date).slice(0, 10) > due) return fail(res, 400, 'OUTSIDE_ENGAGEMENT_DATES', 'Rentang tanggal sasaran berada di luar judul audit.');
  }
  await db.query('UPDATE targets SET engagement_id = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2', [engagementId, targetId]);
  res.json(await getTarget(targetId));
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
  await db.query(`INSERT INTO target_progress_history
    (target_id, user_id, progress, audit_status, data_progress, analysis_progress, workpaper_progress, note)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
  [target.id, req.user.id, progress, auditStatus, ...stageValues, note]);
  res.json(await getTarget(target.id));
}

async function reviewTarget(req, res) {
  const target = await getTarget(req.params.id);
  if (!target) return fail(res, 404, 'TARGET_NOT_FOUND', 'Target tidak ditemukan.');
  if (target.status !== 'submitted') return fail(res, 409, 'NOT_READY_FOR_REVIEW', 'Target belum dikirim untuk direview.');
  const { status } = req.body;
  const feedback = typeof req.body.feedback === 'string' ? req.body.feedback.trim() : '';
  if (!['completed', 'revision'].includes(status) || feedback.length > 4000 || (status === 'revision' && !feedback)) return fail(res, 400, 'INVALID_REVIEW', 'Pilih hasil review dan isi catatan revisi bila diperlukan.');
  const quality = ['procedure_followed', 'evidence_sufficient', 'conclusion_reviewed'].map(key => req.body[`quality_${key}`]);
  const qualityNotes = typeof req.body.quality_review_notes === 'string' ? req.body.quality_review_notes.trim() : '';
  if (qualityNotes.length > 4000) return fail(res, 400, 'INVALID_QUALITY_NOTES', 'Catatan mutu maksimal 4000 karakter.');
  if (status === 'completed' && quality.some(value => value !== true)) return fail(res, 400, 'QUALITY_REVIEW_REQUIRED', 'Sebelum menyelesaikan target, pastikan prosedur dipenuhi, bukti memadai, dan simpulan telah direview.');
  await db.query(`UPDATE targets SET status = $1, audit_status = $2, feedback = $3,
    completed_at = CASE WHEN $1 = 'completed' THEN CURRENT_TIMESTAMP ELSE NULL END,
    review_rounds = review_rounds + CASE WHEN $1 = 'revision' THEN 1 ELSE 0 END,
    quality_procedure_followed = $4, quality_evidence_sufficient = $5, quality_conclusion_reviewed = $6,
    quality_review_notes = $7, quality_reviewed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
    WHERE id = $8`,
  [status, status === 'completed' ? 'Selesai' : 'Berjalan', feedback, ...quality.map(value => value === true), qualityNotes, target.id]);
  const { rows: updatedTarget } = await db.query('SELECT * FROM targets WHERE id = $1', [target.id]);
  await db.query(`INSERT INTO target_progress_history
    (target_id, user_id, progress, audit_status, data_progress, analysis_progress, workpaper_progress, note)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
  [target.id, req.user.id, updatedTarget[0].progress, status === 'completed' ? 'Selesai' : 'Berjalan', updatedTarget[0].data_progress, updatedTarget[0].analysis_progress, updatedTarget[0].workpaper_progress, feedback]);
  res.json(await getTarget(target.id));
}

async function getTargetForActor(targetId, user) {
  if (!Number.isInteger(targetId) || targetId < 1) return { error: { status: 400, code: 'INVALID_ID', message: 'ID target tidak valid.' } };
  const target = await getTarget(targetId);
  if (!target) return { error: { status: 404, code: 'TARGET_NOT_FOUND', message: 'Target tidak ditemukan.' } };
  if (!canAccess(target, user)) return { error: { status: 403, code: 'FORBIDDEN', message: 'Akses ditolak.' } };
  return { target };
}

async function listDataRequests(req, res) {
  const result = await getTargetForActor(Number(req.params.id), req.user);
  if (result.error) return fail(res, result.error.status, result.error.code, result.error.message);
  const { rows } = await db.query('SELECT * FROM auditee_data_requests WHERE target_id = $1 ORDER BY due_date, id', [result.target.id]);
  res.json(rows);
}

async function createDataRequest(req, res) {
  const result = await getTargetForActor(Number(req.params.id), req.user);
  if (result.error) return fail(res, result.error.status, result.error.code, result.error.message);
  const item = typeof req.body.requested_item === 'string' ? req.body.requested_item.trim() : '';
  const pic = typeof req.body.auditee_pic === 'string' ? req.body.auditee_pic.trim() : '';
  const requestedAt = req.body.requested_at;
  const dueDate = req.body.due_date;
  if (!item || item.length > 1000 || !pic || pic.length > 200 || !validDate(requestedAt) || !validDate(dueDate) || dueDate < requestedAt) return fail(res, 400, 'INVALID_DATA_REQUEST', 'Isi kebutuhan data, PIC auditee, tanggal permintaan, dan tenggat yang valid.');
  const { rows } = await db.query(`INSERT INTO auditee_data_requests
    (target_id, created_by, requested_item, auditee_pic, requested_at, due_date)
    VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
  [result.target.id, req.user.id, item, pic, requestedAt, dueDate]);
  res.status(201).json(rows[0]);
}

async function updateDataRequest(req, res) {
  const requestId = Number(req.params.requestId);
  const { rows } = await db.query('SELECT * FROM auditee_data_requests WHERE id = $1', [requestId]);
  const request = rows[0];
  if (!request) return fail(res, 404, 'REQUEST_NOT_FOUND', 'Permintaan data tidak ditemukan.');
  const result = await getTargetForActor(request.target_id, req.user);
  if (result.error) return fail(res, result.error.status, result.error.code, result.error.message);
  const status = req.body.status ?? request.status;
  const followUp = typeof req.body.follow_up === 'string' ? req.body.follow_up.trim() : request.follow_up;
  const handoverNote = typeof req.body.handover_note === 'string' ? req.body.handover_note.trim() : request.handover_note;
  const receivedAt = req.body.received_at ?? request.received_at;
  if (!['requested', 'received', 'verified', 'rejected'].includes(status) || followUp.length > 3000 || handoverNote.length > 1000) return fail(res, 400, 'INVALID_REQUEST_UPDATE', 'Periksa status dan panjang catatan permintaan data.');
  if (['received', 'verified'].includes(status) && !validDate(String(receivedAt).slice(0, 10))) return fail(res, 400, 'RECEIVED_DATE_REQUIRED', 'Isi tanggal data diterima sebelum melanjutkan.');
  if (status === 'verified' && req.user.role !== 'admin') return fail(res, 403, 'ADMIN_VERIFICATION_REQUIRED', 'Verifikasi akhir dilakukan oleh ketua tim.');
  const escalatedAt = req.body.escalate === true ? new Date().toISOString() : request.escalated_at;
  const handoverAt = req.body.direct_handover === true ? new Date().toISOString() : request.handover_at;
  const verifiedAt = status === 'verified' ? new Date().toISOString() : request.verified_at;
  const { rows: updated } = await db.query(`UPDATE auditee_data_requests SET status = $1, follow_up = $2,
    received_at = $3, verified_at = $4, escalated_at = $5, handover_at = $6, handover_note = $7,
    updated_at = CURRENT_TIMESTAMP WHERE id = $8 RETURNING *`,
  [status, followUp, status === 'requested' ? null : receivedAt, verifiedAt, escalatedAt, handoverAt, handoverNote, requestId]);
  res.json(updated[0]);
}

async function listWorkLogs(req, res) {
  const result = await getTargetForActor(Number(req.params.id), req.user);
  if (result.error) return fail(res, result.error.status, result.error.code, result.error.message);
  const { rows } = await db.query(`SELECT w.*, u.name AS member_name FROM target_work_logs w JOIN users u ON u.id = w.user_id
    WHERE w.target_id = $1 ORDER BY w.work_date DESC, w.id DESC`, [result.target.id]);
  res.json(rows);
}

async function createWorkLog(req, res) {
  const result = await getTargetForActor(Number(req.params.id), req.user);
  if (result.error) return fail(res, result.error.status, result.error.code, result.error.message);
  const workDate = req.body.work_date;
  const hours = Number(req.body.hours);
  const note = typeof req.body.note === 'string' ? req.body.note.trim() : '';
  if (!validDate(workDate) || !Number.isFinite(hours) || hours <= 0 || hours > 24 || note.length > 2000) return fail(res, 400, 'INVALID_WORK_LOG', 'Isi tanggal, jam kerja 0–24, dan catatan maksimal 2000 karakter.');
  const { rows } = await db.query(`INSERT INTO target_work_logs (target_id, user_id, work_date, hours, note)
    VALUES ($1,$2,$3,$4,$5) RETURNING *`, [result.target.id, req.user.id, workDate, hours, note]);
  res.status(201).json(rows[0]);
}

module.exports = {
  listTargets, targetDetail, createTarget, updateProgress, reviewTarget,
  assignTargetEngagement, listDataRequests, createDataRequest, updateDataRequest, listWorkLogs, createWorkLog,
};
