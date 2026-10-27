const { db } = require('../config/db');
const { uploadDocument, deleteDocument, createPrivateDocumentUrl } = require('../config/cloudinary');
const { getCommentsForSubmission } = require('./commentController');
const { normalizeFilename } = require('../utils/normalizeFilename');

function normalizeSubmission(submission) {
  const { file_path, file_public_id, file_resource_type, file_format, ...safe } = submission;
  return { ...safe, file_name: normalizeFilename(submission.file_name), file_url: `/api/submissions/${submission.id}/file` };
}

function validId(value) {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

async function getAllSubmissions(req, res) {
  const { status, search } = req.query;
  const conditions = [], params = [];
  if (status && status !== 'Semua') { params.push(status); conditions.push(`s.status = $${params.length}`); }
  if (search) {
    const pattern = `%${search}%`;
    params.push(pattern, pattern);
    conditions.push(`(s.title ILIKE $${params.length - 1} OR u.name ILIKE $${params.length})`);
  }

  const { rows } = await db.query(`
    SELECT s.*, u.name AS member_name, u.email AS member_email
    FROM submissions s
    JOIN users u ON s.member_id = u.id
    ${conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''}
    ORDER BY s.submitted_at DESC
  `, params);
  res.json(rows.map(normalizeSubmission));
}

async function getMySubmissions(req, res) {
  const { rows } = await db.query(
    'SELECT * FROM submissions WHERE member_id = $1 ORDER BY submitted_at DESC',
    [req.user.id],
  );
  res.json(rows.map(normalizeSubmission));
}

async function getSubmissionById(req, res) {
  const submissionId = validId(req.params.id);
  if (!submissionId) return res.status(400).json({ code: 'INVALID_ID', message: 'ID dokumen tidak valid.' });
  const { rows } = await db.query(`
    SELECT s.*, u.name AS member_name, u.email AS member_email
    FROM submissions s
    JOIN users u ON s.member_id = u.id
    WHERE s.id = $1
  `, [submissionId]);
  const submission = rows[0];
  if (!submission) return res.status(404).json({ message: 'Submission tidak ditemukan.' });
  if (req.user.role === 'member' && submission.member_id !== req.user.id) {
    return res.status(403).json({ message: 'Akses ditolak.' });
  }
  const comments = await getCommentsForSubmission(submissionId);
  res.json({ ...normalizeSubmission(submission), comments });
}

async function downloadSubmission(req, res) {
  const submissionId = validId(req.params.id);
  if (!submissionId) return res.status(400).json({ code: 'INVALID_ID', message: 'ID dokumen tidak valid.' });
  const { rows } = await db.query(
    'SELECT id, member_id, file_path, file_name, file_public_id, file_resource_type, file_format FROM submissions WHERE id = $1',
    [submissionId],
  );
  const submission = rows[0];
  if (!submission) return res.status(404).json({ message: 'Dokumen tidak ditemukan.' });
  if (req.user.role === 'member' && submission.member_id !== req.user.id) return res.status(403).json({ message: 'Akses ditolak.' });

  const sourceUrl = submission.file_public_id
    ? createPrivateDocumentUrl(submission.file_public_id, submission.file_resource_type || 'raw', submission.file_format)
    : submission.file_path;
  let parsed;
  try { parsed = new URL(sourceUrl); } catch { return res.status(502).json({ message: 'Lokasi dokumen tidak valid.' }); }
  if (parsed.protocol !== 'https:' || parsed.hostname !== 'res.cloudinary.com') {
    return res.status(502).json({ message: 'Penyedia dokumen tidak valid.' });
  }
  const upstream = await fetch(sourceUrl, { redirect: 'error', signal: AbortSignal.timeout(20000) });
  if (!upstream.ok) return res.status(502).json({ message: 'Dokumen belum dapat diambil dari penyimpanan.' });
  const content = Buffer.from(await upstream.arrayBuffer());
  const safeName = normalizeFilename(submission.file_name).replace(/[\r\n"\\]/g, '_');
  res.set({
    'Content-Type': upstream.headers.get('content-type') || 'application/octet-stream',
    'Content-Length': String(content.length),
    'Content-Disposition': `attachment; filename="${safeName}"; filename*=UTF-8''${encodeURIComponent(safeName)}`,
    'X-Content-Type-Options': 'nosniff',
    'Cache-Control': 'private, no-store, max-age=0',
  });
  return res.send(content);
}

async function createSubmission(req, res) {
  const title = typeof req.body.title === 'string' ? req.body.title.trim() : '';
  const description = typeof req.body.description === 'string' ? req.body.description.trim() : '';
  if (!title || title.length > 200 || description.length > 5000) {
    return res.status(400).json({ message: 'Judul wajib diisi (maksimal 200 karakter), deskripsi maksimal 5000 karakter.' });
  }
  if (!req.file) return res.status(400).json({ message: 'File dokumen wajib diunggah.' });

  let targetId = null;
  if (req.body.target_id !== undefined && req.body.target_id !== '') {
    targetId = Number(req.body.target_id);
    if (!Number.isInteger(targetId)) return res.status(400).json({ message: 'Target tidak valid.' });
    const { rows } = await db.query('SELECT assigned_to, status FROM targets WHERE id = $1', [targetId]);
    const target = rows[0];
    if (!target) return res.status(404).json({ message: 'Target tidak ditemukan.' });
    if (target.assigned_to !== req.user.id) return res.status(403).json({ message: 'Akses ditolak.' });
    if (target.status === 'completed') return res.status(409).json({ message: 'Target sudah selesai.' });
  }

  const uploaded = await uploadDocument(req.file);
  try {
    const { rows } = await db.query(`
      INSERT INTO submissions (member_id, title, description, file_path, file_name, target_id, file_public_id, file_resource_type, file_format)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING id
    `, [
      req.user.id,
      title,
      description,
      uploaded.secure_url,
      normalizeFilename(req.file.originalname),
      targetId,
      uploaded.public_id,
      uploaded.resource_type,
      uploaded.format || null,
    ]);
    res.status(201).json({ message: 'Submission berhasil diunggah.', id: rows[0].id });
  } catch (error) {
    try {
      await deleteDocument(uploaded.public_id, uploaded.resource_type);
    } catch (cleanupError) {
      console.error(`Cloudinary cleanup failed for ${uploaded.public_id}: ${cleanupError.message}`);
    }
    throw error;
  }
}

async function updateStatus(req, res) {
  const { id } = req.params;
  const { status } = req.body;
  if (!['Menunggu', 'Disetujui', 'Perlu Revisi'].includes(status)) {
    return res.status(400).json({ message: 'Status tidak valid.' });
  }
  const { rows } = await db.query('UPDATE submissions SET status = $1 WHERE id = $2 RETURNING id', [status, id]);
  if (!rows[0]) return res.status(404).json({ message: 'Submission tidak ditemukan.' });
  res.json({ message: 'Status berhasil diperbarui.' });
}

async function getStats(req, res) {
  const [{ rows: submissionRows }, { rows: targetRows }, { rows: monthlyRows }, { rows: memberRows }] = await Promise.all([
    db.query(`SELECT
      COUNT(*)::int AS total,
      COUNT(CASE WHEN status = 'Menunggu' THEN 1 END)::int AS menunggu,
      COUNT(CASE WHEN status = 'Disetujui' THEN 1 END)::int AS disetujui,
      COUNT(CASE WHEN status = 'Perlu Revisi' THEN 1 END)::int AS "perluRevisi"
      FROM submissions`),
    db.query(`SELECT
      COUNT(*)::int AS "targetTotal",
      COUNT(CASE WHEN status = 'completed' THEN 1 END)::int AS "targetCompleted",
      COUNT(CASE WHEN status = 'submitted' THEN 1 END)::int AS "targetPendingReview"
      FROM targets`),
    db.query(`SELECT TO_CHAR(date_trunc('month', submitted_at), 'YYYY-MM') AS month,
      COUNT(*)::int AS submitted,
      COUNT(CASE WHEN status = 'Disetujui' THEN 1 END)::int AS approved
      FROM submissions
      WHERE submitted_at >= date_trunc('month', CURRENT_TIMESTAMP) - INTERVAL '11 months'
      GROUP BY date_trunc('month', submitted_at)
      ORDER BY date_trunc('month', submitted_at)`),
    db.query("SELECT COUNT(*)::int AS count FROM users WHERE role = 'member'"),
  ]);
  const countsByMonth = new Map(monthlyRows.map(row => [row.month, row]));
  const now = new Date();
  const monthly = Array.from({ length: 12 }, (_, index) => {
    const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 11 + index, 1));
    const month = date.toISOString().slice(0, 7);
    const counts = countsByMonth.get(month);
    return { month, submitted: counts?.submitted || 0, approved: counts?.approved || 0 };
  });
  res.json({ ...submissionRows[0], ...targetRows[0], totalMembers: memberRows[0].count, monthly });
}

module.exports = {
  getAllSubmissions,
  getMySubmissions,
  getSubmissionById,
  downloadSubmission,
  createSubmission,
  updateStatus,
  getStats,
};
