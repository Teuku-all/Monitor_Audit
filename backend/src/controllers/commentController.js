const { db } = require('../config/db');

function addComment(req, res) {
  const { submission_id } = req.params;
  const body = typeof req.body.body === 'string' ? req.body.body.trim() : '';

  if (!body || !body.trim()) {
    return res.status(400).json({ message: 'Isi komentar tidak boleh kosong.' });
  }
  if (body.length > 4000) return res.status(400).json({ message: 'Komentar maksimal 4000 karakter.' });

  const submission = db.prepare('SELECT id FROM submissions WHERE id = ?').get(submission_id);
  if (!submission) {
    return res.status(404).json({ message: 'Submission tidak ditemukan.' });
  }

  const result = db.prepare(`
    INSERT INTO comments (submission_id, admin_id, body) VALUES (?, ?, ?)
  `).run(submission_id, req.user.id, body.trim());

  res.status(201).json({ message: 'Komentar berhasil ditambahkan.', id: result.lastInsertRowid });
}

function getComments(req, res) {
  const { submission_id } = req.params;
  const submission = db.prepare('SELECT id, member_id FROM submissions WHERE id = ?').get(submission_id);
  if (!submission) {
    return res.status(404).json({ message: 'Submission tidak ditemukan.' });
  }
  if (req.user.role === 'member' && submission.member_id !== req.user.id) {
    return res.status(403).json({ message: 'Akses ditolak.' });
  }

  res.json(getCommentsForSubmission(submission_id));
}

function getCommentsForSubmission(submissionId) {
  const comments = db.prepare(`
    SELECT c.*, u.name as admin_name
    FROM comments c
    JOIN users u ON c.admin_id = u.id
    WHERE c.submission_id = ?
    ORDER BY c.created_at ASC
  `).all(submissionId);

  if (!comments.length) return comments;

  const commentIds = comments.map(comment => comment.id);
  const placeholders = commentIds.map(() => '?').join(', ');
  const replies = db.prepare(`
    SELECT r.*, u.name as author_name
    FROM comment_replies r
    JOIN users u ON r.user_id = u.id
    WHERE r.comment_id IN (${placeholders})
    ORDER BY r.created_at ASC, r.id ASC
  `).all(...commentIds);

  const repliesByComment = new Map(commentIds.map(id => [id, []]));
  for (const reply of replies) repliesByComment.get(reply.comment_id).push(reply);
  return comments.map(comment => ({ ...comment, replies: repliesByComment.get(comment.id) }));
}

function addReply(req, res) {
  const { submission_id, comment_id } = req.params;
  const body = typeof req.body.body === 'string' ? req.body.body.trim() : '';

  if (!body) return res.status(400).json({ message: 'Isi balasan tidak boleh kosong.' });
  if (body.length > 2000) return res.status(400).json({ message: 'Balasan maksimal 2000 karakter.' });

  const comment = db.prepare(`
    SELECT c.id, s.member_id
    FROM comments c
    JOIN submissions s ON s.id = c.submission_id
    WHERE c.id = ? AND c.submission_id = ?
  `).get(comment_id, submission_id);

  if (!comment) return res.status(404).json({ message: 'Komentar tidak ditemukan.' });
  if (comment.member_id !== req.user.id) return res.status(403).json({ message: 'Akses ditolak.' });

  const result = db.prepare(`
    INSERT INTO comment_replies (comment_id, user_id, body) VALUES (?, ?, ?)
  `).run(comment_id, req.user.id, body);

  const reply = db.prepare(`
    SELECT r.*, u.name as author_name
    FROM comment_replies r
    JOIN users u ON r.user_id = u.id
    WHERE r.id = ?
  `).get(result.lastInsertRowid);

  res.status(201).json({ message: 'Balasan berhasil dikirim.', reply });
}

module.exports = { addComment, addReply, getComments, getCommentsForSubmission };
