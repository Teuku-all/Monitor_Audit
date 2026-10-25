const { db } = require('../config/db');
const { getCommentsForSubmission } = require('./commentController');
const { normalizeFilename } = require('../utils/normalizeFilename');
const fs = require('fs');

function normalizeSubmission(submission) {
  return { ...submission, file_name: normalizeFilename(submission.file_name) };
}

// Admin: get all submissions
function getAllSubmissions(req, res) {
  const { status, search } = req.query;

  let query = `
    SELECT s.*, u.name as member_name, u.email as member_email
    FROM submissions s
    JOIN users u ON s.member_id = u.id
  `;
  const params = [];
  const conditions = [];

  if (status && status !== 'Semua') {
    conditions.push('s.status = ?');
    params.push(status);
  }
  if (search) {
    conditions.push('(s.title LIKE ? OR u.name LIKE ?)');
    params.push(`%${search}%`, `%${search}%`);
  }

  if (conditions.length) query += ' WHERE ' + conditions.join(' AND ');
  query += ' ORDER BY s.submitted_at DESC';

  const submissions = db.prepare(query).all(...params).map(normalizeSubmission);
  res.json(submissions);
}

// Member: get own submissions
function getMySubmissions(req, res) {
  const submissions = db.prepare(`
    SELECT * FROM submissions WHERE member_id = ? ORDER BY submitted_at DESC
  `).all(req.user.id).map(normalizeSubmission);
  res.json(submissions);
}

// Get single submission detail
function getSubmissionById(req, res) {
  const { id } = req.params;
  const submission = db.prepare(`
    SELECT s.*, u.name as member_name, u.email as member_email
    FROM submissions s
    JOIN users u ON s.member_id = u.id
    WHERE s.id = ?
  `).get(id);

  if (!submission) return res.status(404).json({ message: 'Submission tidak ditemukan.' });

  // Member only can see their own
  if (req.user.role === 'member' && submission.member_id !== req.user.id) {
    return res.status(403).json({ message: 'Akses ditolak.' });
  }

  // Get comments
  const comments = getCommentsForSubmission(id);

  res.json({ ...normalizeSubmission(submission), comments });
}

// Member: create submission
function createSubmission(req, res) {
  const title = typeof req.body.title === 'string' ? req.body.title.trim() : '';
  const description = typeof req.body.description === 'string' ? req.body.description.trim() : '';
  function reject(status, message) {
    if (req.file) fs.rmSync(req.file.path, { force: true });
    return res.status(status).json({ message });
  }
  if (!title || title.length > 200 || description.length > 5000) return reject(400, 'Judul wajib diisi (maksimal 200 karakter), deskripsi maksimal 5000 karakter.');
  if (!req.file) return res.status(400).json({ message: 'File dokumen wajib diunggah.' });

  let targetId = null;
  if (req.body.target_id !== undefined && req.body.target_id !== '') {
    targetId = Number(req.body.target_id);
    if (!Number.isInteger(targetId)) return reject(400, 'Target tidak valid.');
    const target = db.prepare('SELECT assigned_to, status FROM targets WHERE id = ?').get(targetId);
    if (!target) return reject(404, 'Target tidak ditemukan.');
    if (target.assigned_to !== req.user.id) return reject(403, 'Akses ditolak.');
    if (target.status === 'completed') return reject(409, 'Target sudah selesai.');
  }

  const result = db.prepare(`
    INSERT INTO submissions (member_id, title, description, file_path, file_name, target_id)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(req.user.id, title, description, req.file.filename, normalizeFilename(req.file.originalname), targetId);

  res.status(201).json({ message: 'Submission berhasil diunggah.', id: result.lastInsertRowid });
}

// Admin: update status
function updateStatus(req, res) {
  const { id } = req.params;
  const { status } = req.body;

  const allowed = ['Menunggu', 'Disetujui', 'Perlu Revisi'];
  if (!allowed.includes(status)) {
    return res.status(400).json({ message: 'Status tidak valid.' });
  }

  const submission = db.prepare('SELECT id FROM submissions WHERE id = ?').get(id);
  if (!submission) return res.status(404).json({ message: 'Submission tidak ditemukan.' });

  db.prepare('UPDATE submissions SET status = ? WHERE id = ?').run(status, id);
  res.json({ message: 'Status berhasil diperbarui.' });
}

// Admin: get stats summary
function getStats(req, res) {
  const total = db.prepare('SELECT COUNT(*) as count FROM submissions').get().count;
  const menunggu = db.prepare("SELECT COUNT(*) as count FROM submissions WHERE status = 'Menunggu'").get().count;
  const disetujui = db.prepare("SELECT COUNT(*) as count FROM submissions WHERE status = 'Disetujui'").get().count;
  const perluRevisi = db.prepare("SELECT COUNT(*) as count FROM submissions WHERE status = 'Perlu Revisi'").get().count;
  const totalMembers = db.prepare("SELECT COUNT(*) as count FROM users WHERE role = 'member'").get().count;

  const targetTotal = db.prepare('SELECT COUNT(*) AS count FROM targets').get().count;
  const targetCompleted = db.prepare("SELECT COUNT(*) AS count FROM targets WHERE status = 'completed'").get().count;
  const targetPendingReview = db.prepare("SELECT COUNT(*) AS count FROM targets WHERE status = 'submitted'").get().count;
  const now = new Date();
  const monthly = Array.from({ length: 12 }, (_, index) => {
    const month = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 11 + index, 1)).toISOString().slice(0, 7);
    const counts = db.prepare(`SELECT COUNT(*) AS submitted,
      COALESCE(SUM(CASE WHEN status = 'Disetujui' THEN 1 ELSE 0 END), 0) AS approved
      FROM submissions WHERE strftime('%Y-%m', submitted_at) = ?`).get(month);
    return { month, ...counts };
  });
  res.json({ total, menunggu, disetujui, perluRevisi, totalMembers, targetTotal, targetCompleted, targetPendingReview, monthly });
}

module.exports = {
  getAllSubmissions,
  getMySubmissions,
  getSubmissionById,
  createSubmission,
  updateStatus,
  getStats,
};
