const router = require('express').Router();
const { db } = require('../config/db');
const { authenticate } = require('../middleware/auth');
const { requireRole } = require('../middleware/roleCheck');
const asyncHandler = require('../middleware/asyncHandler');
router.get('/', asyncHandler(authenticate), requireRole('admin'), asyncHandler(async (req, res) => {
  const [{ rows: members }, { rows: targetCounts }, { rows: submissionCounts }] = await Promise.all([
    db.query("SELECT id, name, email, role, created_at FROM users WHERE role = 'member' ORDER BY lower(name), id"),
    db.query(`SELECT assigned_to,
      COUNT(CASE WHEN status != 'completed' THEN 1 END)::int AS active_targets,
      COUNT(CASE WHEN status = 'completed' THEN 1 END)::int AS completed_targets
      FROM targets GROUP BY assigned_to`),
    db.query('SELECT member_id, COUNT(*)::int AS submission_count FROM submissions GROUP BY member_id'),
  ]);
  const targetsByMember = new Map(targetCounts.map(row => [row.assigned_to, row]));
  const submissionsByMember = new Map(submissionCounts.map(row => [row.member_id, row.submission_count]));
  res.json(members.map(member => ({
    ...member,
    active_targets: targetsByMember.get(member.id)?.active_targets || 0,
    completed_targets: targetsByMember.get(member.id)?.completed_targets || 0,
    submission_count: submissionsByMember.get(member.id) || 0,
  })));
}));
module.exports = router;
