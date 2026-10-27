const { db } = require('../config/db');
const { validDate, addBusinessDays, withScheduleStatus } = require('../utils/auditDates');

function fail(res, status, code, message) { return res.status(status).json({ code, message }); }

async function programSummary(program) {
  const { rows: engagementRows } = await db.query(`
    SELECT e.*,
      COUNT(t.id)::int AS total_objectives,
      (COUNT(t.id) FILTER (WHERE t.status = 'completed'))::int AS completed_objectives,
      (COUNT(t.id) FILTER (WHERE t.status = 'completed' AND t.completed_at::date <= t.due_date))::int AS on_time_objectives,
      (COUNT(t.id) FILTER (WHERE t.status = 'completed' AND t.review_rounds = 0))::int AS first_pass_objectives,
      (COUNT(t.id) FILTER (WHERE t.status = 'completed' OR t.review_rounds > 0))::int AS reviewed_objectives,
      ROUND(AVG(t.progress))::int AS average_progress,
      (COUNT(t.id) FILTER (WHERE t.status != 'completed' AND t.updated_at < CURRENT_TIMESTAMP - INTERVAL '7 days'))::int AS stale_objectives,
      MAX(t.completed_at) AS actual_completed_at
    FROM audit_engagements e
    LEFT JOIN targets t ON t.engagement_id = e.id
    WHERE e.program_id = $1
    GROUP BY e.id
    ORDER BY e.start_date, e.id
  `, [program.id]);
  const engagements = engagementRows.map(engagement => {
    const completed = Number(engagement.total_objectives) > 0
      && Number(engagement.completed_objectives) === Number(engagement.total_objectives);
    const completedAt = completed ? engagement.actual_completed_at : null;
    const schedule = withScheduleStatus({ ...engagement, status: completed ? 'completed' : 'active', due_date: engagement.due_date });
    return {
      ...schedule,
      completed,
      completed_at: completedAt,
      on_time: completed && completedAt && new Date(completedAt).toISOString().slice(0, 10) <= engagement.due_date,
    };
  });
  const completedEngagements = engagements.filter(item => item.completed);
  const eligibleEngagements = engagements.filter(item => item.completed || item.remaining_days < 0);
  const onTimeEngagements = completedEngagements.filter(item => item.on_time).length;
  const reviewedObjectives = engagements.reduce((sum, item) => sum + Number(item.reviewed_objectives), 0);
  const firstPassObjectives = engagements.reduce((sum, item) => sum + Number(item.first_pass_objectives), 0);
  const requestRows = await db.query(`
    SELECT COUNT(*)::int AS total_requests,
      (COUNT(*) FILTER (WHERE r.status = 'verified'))::int AS verified_requests,
      (COUNT(*) FILTER (WHERE r.status != 'verified'))::int AS open_requests,
      (COUNT(*) FILTER (WHERE r.status != 'verified' AND r.due_date < CURRENT_DATE))::int AS overdue_requests
    FROM auditee_data_requests r
    JOIN targets t ON t.id = r.target_id
    JOIN audit_engagements e ON e.id = t.engagement_id
    WHERE e.program_id = $1
  `, [program.id]);
  return {
    ...program,
    engagements,
    total_engagements: engagements.length,
    completed_engagements: completedEngagements.length,
    on_time_engagements: onTimeEngagements,
    on_time_rate: eligibleEngagements.length ? Math.round(onTimeEngagements / eligibleEngagements.length * 100) : null,
    first_pass_rate: reviewedObjectives ? Math.round(firstPassObjectives / reviewedObjectives * 100) : null,
    completed_objectives: reviewedObjectives,
    first_pass_objectives: firstPassObjectives,
    stale_objectives: engagements.reduce((sum, item) => sum + Number(item.stale_objectives), 0),
    open_data_requests: Number(requestRows.rows[0]?.open_requests || 0),
    overdue_data_requests: Number(requestRows.rows[0]?.overdue_requests || 0),
    total_data_requests: Number(requestRows.rows[0]?.total_requests || 0),
    verified_data_requests: Number(requestRows.rows[0]?.verified_requests || 0),
    data_request_rate: Number(requestRows.rows[0]?.total_requests) ? Math.round(Number(requestRows.rows[0].verified_requests) / Number(requestRows.rows[0].total_requests) * 100) : null,
  };
}

async function list(req, res) {
  const { rows } = await db.query('SELECT * FROM audit_programs ORDER BY start_date DESC, id DESC');
  res.json(await Promise.all(rows.map(programSummary)));
}

async function get(req, res) {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) return fail(res, 400, 'INVALID_ID', 'ID program tidak valid.');
  const { rows } = await db.query('SELECT * FROM audit_programs WHERE id = $1', [id]);
  if (!rows[0]) return fail(res, 404, 'PROGRAM_NOT_FOUND', 'Program audit tidak ditemukan.');
  res.json(await programSummary(rows[0]));
}

async function create(req, res) {
  const title = typeof req.body.title === 'string' ? req.body.title.trim() : '';
  const period = typeof req.body.period === 'string' ? req.body.period.trim() : '';
  const startDate = req.body.start_date;
  const workdays = Number(req.body.standard_workdays ?? 45);
  const dueDate = req.body.due_date || (validDate(startDate) && Number.isInteger(workdays) && workdays > 0 ? addBusinessDays(startDate, workdays) : '');
  const baselineOnTime = req.body.baseline_on_time_rate === '' || req.body.baseline_on_time_rate == null ? null : Number(req.body.baseline_on_time_rate);
  const baselineFirstPass = req.body.baseline_first_pass_rate === '' || req.body.baseline_first_pass_rate == null ? null : Number(req.body.baseline_first_pass_rate);
  if (!title || title.length > 200 || period.length > 100) return fail(res, 400, 'INVALID_PROGRAM', 'Nama program wajib diisi dan maksimal 200 karakter.');
  if (!validDate(startDate) || !validDate(dueDate) || dueDate < startDate) return fail(res, 400, 'INVALID_DATES', 'Tanggal program tidak valid.');
  if (!Number.isInteger(workdays) || workdays < 1 || workdays > 260) return fail(res, 400, 'INVALID_STANDARD_DAYS', 'Durasi standar harus 1 sampai 260 hari kerja.');
  if ([baselineOnTime, baselineFirstPass].some(value => value !== null && (!Number.isFinite(value) || value < 0 || value > 100))) return fail(res, 400, 'INVALID_BASELINE', 'Nilai baseline harus 0 sampai 100 persen.');
  const { rows } = await db.query(`
    INSERT INTO audit_programs (title, period, start_date, due_date, standard_workdays, baseline_on_time_rate, baseline_first_pass_rate, created_by)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *
  `, [title, period, startDate, dueDate, workdays, baselineOnTime, baselineFirstPass, req.user.id]);
  res.status(201).json(await programSummary(rows[0]));
}

async function update(req, res) {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) return fail(res, 400, 'INVALID_ID', 'ID program tidak valid.');
  const { rows: currentRows } = await db.query('SELECT * FROM audit_programs WHERE id = $1', [id]);
  const current = currentRows[0];
  if (!current) return fail(res, 404, 'PROGRAM_NOT_FOUND', 'Program audit tidak ditemukan.');
  const baselineOnTime = req.body.baseline_on_time_rate === '' || req.body.baseline_on_time_rate == null ? null : Number(req.body.baseline_on_time_rate);
  const baselineFirstPass = req.body.baseline_first_pass_rate === '' || req.body.baseline_first_pass_rate == null ? null : Number(req.body.baseline_first_pass_rate);
  if ([baselineOnTime, baselineFirstPass].some(value => value !== null && (!Number.isFinite(value) || value < 0 || value > 100))) return fail(res, 400, 'INVALID_BASELINE', 'Nilai baseline harus 0 sampai 100 persen.');
  const { rows } = await db.query(`UPDATE audit_programs
    SET baseline_on_time_rate = $1, baseline_first_pass_rate = $2 WHERE id = $3 RETURNING *`,
  [baselineOnTime, baselineFirstPass, id]);
  res.json(await programSummary(rows[0]));
}

async function createEngagement(req, res) {
  const programId = Number(req.params.id);
  const title = typeof req.body.title === 'string' ? req.body.title.trim() : '';
  const { rows: programs } = await db.query('SELECT id, start_date, due_date FROM audit_programs WHERE id = $1', [programId]);
  if (!programs[0]) return fail(res, 404, 'PROGRAM_NOT_FOUND', 'Program audit tidak ditemukan.');
  const startDate = req.body.start_date || programs[0].start_date.toISOString?.().slice(0, 10) || String(programs[0].start_date).slice(0, 10);
  const dueDate = req.body.due_date || programs[0].due_date.toISOString?.().slice(0, 10) || String(programs[0].due_date).slice(0, 10);
  if (!title || title.length > 200 || !validDate(startDate) || !validDate(dueDate) || dueDate < startDate) return fail(res, 400, 'INVALID_ENGAGEMENT', 'Judul audit dan rentang tanggal yang valid wajib diisi.');
  if (startDate < String(programs[0].start_date).slice(0, 10) || dueDate > String(programs[0].due_date).slice(0, 10)) return fail(res, 400, 'OUTSIDE_PROGRAM_DATES', 'Tanggal judul audit harus berada dalam rentang program.');
  const { rows } = await db.query(`INSERT INTO audit_engagements (program_id, title, start_date, due_date)
    VALUES ($1,$2,$3,$4) RETURNING *`, [programId, title, startDate, dueDate]);
  res.status(201).json(withScheduleStatus({ ...rows[0], total_objectives: 0, completed_objectives: 0, status: 'active' }));
}

module.exports = { list, get, create, update, createEngagement };
