const router = require('express').Router();
const { db } = require('../config/db');
const { authenticate } = require('../middleware/auth');
const { requireRole } = require('../middleware/roleCheck');
router.get('/', authenticate, requireRole('admin'), (req, res) => {
  res.json(db.prepare(`SELECT u.id, u.name, u.email, u.role, u.created_at,
    (SELECT COUNT(*) FROM targets t WHERE t.assigned_to = u.id AND t.status != 'completed') AS active_targets,
    (SELECT COUNT(*) FROM targets t WHERE t.assigned_to = u.id AND t.status = 'completed') AS completed_targets,
    (SELECT COUNT(*) FROM submissions s WHERE s.member_id = u.id) AS submission_count
    FROM users u WHERE u.role = 'member' ORDER BY u.name COLLATE NOCASE, u.id`).all());
});
module.exports = router;
