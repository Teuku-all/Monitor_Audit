const { db } = require('../config/db');
const { getCommentsForSubmission } = require('./commentController');

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

  const submissions = db.prepare(query).all(...params);
  res.json(submissions);
}

// Member: get own submissions
function getMySubmissions(req, res) {
  const submissions = db.prepare(`
    SELECT * FROM submissions WHERE member_id = ? ORDER BY submitted_at DESC
  `).all(req.user.id);
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

  res.json({ ...submission, comments });
}

// Member: create submission
function createSubmission(req, res) {
  const { title, description } = req.body;

  if (!title) return res.status(400).json({ message: 'Judul submission wajib diisi.' });
  if (!req.file) return res.status(400).json({ message: 'File dokumen wajib diunggah.' });

  const result = db.prepare(`
    INSERT INTO submissions (member_id, title, description, file_path, file_name)
    VALUES (?, ?, ?, ?, ?)
  `).run(req.user.id, title, description || '', req.file.filename, req.file.originalname);

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

  res.json({ total, menunggu, disetujui, perluRevisi, totalMembers });
}

module.exports = {
  getAllSubmissions,
  getMySubmissions,
  getSubmissionById,
  createSubmission,
  updateStatus,
  getStats,
};
