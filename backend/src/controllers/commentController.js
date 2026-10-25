const { db } = require('../config/db');

async function addComment(req, res) {
  const { submission_id } = req.params;
  const body = typeof req.body.body === 'string' ? req.body.body.trim() : '';
  if (!body) return res.status(400).json({ message: 'Isi komentar tidak boleh kosong.' });
  if (body.length > 4000) return res.status(400).json({ message: 'Komentar maksimal 4000 karakter.' });

  const { rows: submissions } = await db.query('SELECT id FROM submissions WHERE id = $1', [submission_id]);
  if (!submissions[0]) return res.status(404).json({ message: 'Submission tidak ditemukan.' });
  const { rows } = await db.query(
    'INSERT INTO comments (submission_id, admin_id, body) VALUES ($1, $2, $3) RETURNING id',
    [submission_id, req.user.id, body],
  );
  res.status(201).json({ message: 'Komentar berhasil ditambahkan.', id: rows[0].id });
}

async function getComments(req, res) {
  const { submission_id } = req.params;
  const { rows } = await db.query('SELECT id, member_id FROM submissions WHERE id = $1', [submission_id]);
  const submission = rows[0];
  if (!submission) return res.status(404).json({ message: 'Submission tidak ditemukan.' });
  if (req.user.role === 'member' && submission.member_id !== req.user.id) {
    return res.status(403).json({ message: 'Akses ditolak.' });
  }
  res.json(await getCommentsForSubmission(submission_id));
}

async function getCommentsForSubmission(submissionId) {
  const { rows: comments } = await db.query(`
    SELECT c.*, u.name AS admin_name
    FROM comments c
    JOIN users u ON c.admin_id = u.id
    WHERE c.submission_id = $1
    ORDER BY c.created_at ASC
  `, [submissionId]);
  if (!comments.length) return comments;

  const commentIds = comments.map(comment => comment.id);
  const placeholders = commentIds.map((_, index) => `$${index + 1}`).join(', ');
  const { rows: replies } = await db.query(`
    SELECT r.*, u.name AS author_name
    FROM comment_replies r
    JOIN users u ON r.user_id = u.id
    WHERE r.comment_id IN (${placeholders})
    ORDER BY r.created_at ASC, r.id ASC
  `, commentIds);
  const repliesByComment = new Map(commentIds.map(id => [id, []]));
  for (const reply of replies) repliesByComment.get(reply.comment_id).push(reply);
  return comments.map(comment => ({ ...comment, replies: repliesByComment.get(comment.id) }));
}

async function addReply(req, res) {
  const { submission_id, comment_id } = req.params;
  const body = typeof req.body.body === 'string' ? req.body.body.trim() : '';
  if (!body) return res.status(400).json({ message: 'Isi balasan tidak boleh kosong.' });
  if (body.length > 2000) return res.status(400).json({ message: 'Balasan maksimal 2000 karakter.' });

  const { rows: comments } = await db.query(`
    SELECT c.id, s.member_id
    FROM comments c
    JOIN submissions s ON s.id = c.submission_id
    WHERE c.id = $1 AND c.submission_id = $2
  `, [comment_id, submission_id]);
  const comment = comments[0];
  if (!comment) return res.status(404).json({ message: 'Komentar tidak ditemukan.' });
  if (comment.member_id !== req.user.id) return res.status(403).json({ message: 'Akses ditolak.' });

  const { rows } = await db.query(`
    INSERT INTO comment_replies (comment_id, user_id, body) VALUES ($1, $2, $3) RETURNING id
  `, [comment_id, req.user.id, body]);
  const { rows: replyRows } = await db.query(`
    SELECT r.*, u.name AS author_name
    FROM comment_replies r
    JOIN users u ON r.user_id = u.id
    WHERE r.id = $1
  `, [rows[0].id]);
  res.status(201).json({ message: 'Balasan berhasil dikirim.', reply: replyRows[0] });
}

module.exports = { addComment, addReply, getComments, getCommentsForSubmission };
