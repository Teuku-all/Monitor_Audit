const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { newDb } = require('pg-mem');
const { normalizeFilename } = require('../src/utils/normalizeFilename');
const { dateOnly, withScheduleStatus } = require('../src/utils/auditDates');

process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = 'postgres://test:test@localhost/audit_test';
process.env.JWT_SECRET = 'isolated-integration-test-secret';
process.env.GOOGLE_CLIENT_ID = 'test-google-client-id';
process.env.ADMIN_EMAIL = 'admin@example.test';
process.env.ADMIN_PASSWORD = 'integration-admin-password';

const memoryDatabase = newDb({ autoCreateForeignKeyIndices: true });
memoryDatabase.public.interceptQueries(sql => {
  if (!sql.includes('TO_CHAR(date_trunc')) return null;
  return [{ month: new Date().toISOString().slice(0, 7), submitted: 1, approved: 0 }];
});
const { Pool } = memoryDatabase.adapters.createPg();
const pool = new Pool();
const neonPath = require.resolve('@neondatabase/serverless');
require.cache[neonPath] = {
  id: neonPath,
  filename: neonPath,
  loaded: true,
  exports: { Pool: class { constructor() { return pool; } }, neonConfig: {} },
};
const googlePath = require.resolve('google-auth-library');
const googlePayloads = new Map([
  ['google-owner-token', { sub: 'google-owner', email: 'memberone@example.test', email_verified: true, name: 'Member One Google' }],
  ['google-admin-token', { sub: 'google-admin', email: 'admin@example.test', email_verified: true, name: 'Admin Google' }],
  ['google-new-token', { sub: 'google-new', email: 'googleonly@example.test', email_verified: true, name: 'Google Member' }],
  ['google-unverified-token', { sub: 'google-unverified', email: 'unverified@example.test', email_verified: false, name: 'Unverified' }],
]);
require.cache[googlePath] = {
  id: googlePath,
  filename: googlePath,
  loaded: true,
  exports: {
    OAuth2Client: class {
      async verifyIdToken({ idToken, audience }) {
        assert.equal(audience, process.env.GOOGLE_CLIENT_ID);
        const payload = googlePayloads.get(idToken);
        if (!payload) throw new Error('Invalid test Google token.');
        return { getPayload: () => payload };
      }
    },
  },
};
const cloudinaryPath = require.resolve('../src/config/cloudinary');
require.cache[cloudinaryPath] = {
  id: cloudinaryPath,
  filename: cloudinaryPath,
  loaded: true,
  exports: {
    uploadDocument: async file => ({
      secure_url: `https://cloudinary.test/${encodeURIComponent(file.originalname)}`,
      public_id: 'audit-monitor/test-file',
      resource_type: 'raw',
    }),
    deleteDocument: async () => ({ result: 'ok' }),
  },
};

const handler = require('../../api');
const memberPassword = 'member-password-123';
let base;
let server;

async function request(route, { token, method = 'GET', body, multipart, origin } = {}) {
  const rewrittenPath = route.replace(/^\/+/, '');
  const response = await fetch(`${base}/api/index.js?__path=${encodeURIComponent(rewrittenPath)}`, {
    method,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(origin ? { Origin: origin } : {}),
    },
    body: multipart || (body ? JSON.stringify(body) : undefined),
  });
  const data = await response.json();
  return { status: response.status, data, headers: response.headers };
}

async function login(email, password) {
  const result = await request('/auth/login', { method: 'POST', body: { email, password } });
  assert.equal(result.status, 200, JSON.stringify(result.data));
  return result.data;
}

function documentForm(targetId, fileName = 'audit.pdf') {
  const form = new FormData();
  form.set('title', 'Audit evidence');
  form.set('description', 'Evidence document');
  if (targetId) form.set('target_id', String(targetId));
  form.set('file', new Blob(['%PDF-1.4\nIntegration test fixture'], { type: 'application/pdf' }), fileName);
  return form;
}

function disguisedDocumentForm(targetId) {
  const form = new FormData();
  form.set('title', 'Disguised executable');
  form.set('description', 'This must be rejected before storage.');
  form.set('target_id', String(targetId));
  form.set('file', new Blob(['MZ-not-a-pdf'], { type: 'application/pdf' }), 'disguised.pdf');
  return form;
}

test('database date values retain their calendar day and schedule risk', () => {
  assert.equal(dateOnly(new Date(2030, 11, 1)), '2030-12-01');
  assert.equal(dateOnly('2030-12-01'), '2030-12-01');
  assert.equal(dateOnly('2030-12-01T00:00:00.000Z'), '2030-12-01');
  const scheduled = withScheduleStatus({ start_date: new Date(2030, 11, 1), due_date: new Date(2030, 11, 2), status: 'assigned' }, '2030-12-01');
  assert.equal(scheduled.start_date, '2030-12-01');
  assert.equal(scheduled.due_date, '2030-12-02');
  assert.equal(scheduled.remaining_days, 1);
  assert.equal(scheduled.schedule_status, 'yellow');
});

test('PostgreSQL routes retain auth, permissions, targets, uploads, and discussions', async t => {
  t.after(async () => {
    if (server) await new Promise(resolve => server.close(resolve));
    await pool.end();
  });
  server = http.createServer(handler).listen(0);
  await new Promise(resolve => server.once('listening', resolve));
  base = `http://127.0.0.1:${server.address().port}`;

  const admin = await login('admin@example.test', process.env.ADMIN_PASSWORD);
  assert.equal((await request('/auth/google', { method: 'POST', body: {} })).status, 400);
  assert.equal((await request('/auth/google', {
    method: 'POST',
    body: { credential: 'invalid-google-token' },
  })).status, 401);
  assert.equal((await request('/users')).status, 401);
  const signup = await request('/auth/register', {
    method: 'POST',
    body: { name: 'Member One', email: '  MemberOne@Example.test ', password: memberPassword, role: 'admin' },
  });
  assert.equal(signup.status, 201);
  const ownerId = signup.data.userId;
  assert.equal((await request('/auth/register', {
    method: 'POST',
    body: { name: 'Duplicate', email: 'MEMBERONE@example.test', password: memberPassword },
  })).status, 409);
  assert.equal((await request('/auth/register', {
    method: 'POST',
    body: { name: 'Invalid', email: 'invalid', password: memberPassword },
  })).status, 400);
  await request('/auth/register', {
    method: 'POST',
    body: { name: 'Member Two', email: 'other@example.test', password: memberPassword },
  });

  let owner = await login('MEMBERONE@EXAMPLE.TEST', memberPassword);
  assert.equal(owner.user.role, 'member');
  const linkedGoogleUser = await request('/auth/google', {
    method: 'POST',
    body: { credential: 'google-owner-token' },
  });
  assert.equal(linkedGoogleUser.status, 200);
  assert.equal(linkedGoogleUser.data.user.id, ownerId);
  assert.equal(linkedGoogleUser.data.user.role, 'member');
  const googleAdmin = await request('/auth/google', {
    method: 'POST',
    body: { credential: 'google-admin-token' },
  });
  assert.equal(googleAdmin.status, 200);
  assert.equal(googleAdmin.data.user.role, 'admin');
  const googleMember = await request('/auth/google', {
    method: 'POST',
    body: { credential: 'google-new-token' },
  });
  assert.equal(googleMember.status, 200);
  assert.equal(googleMember.data.user.role, 'member');
  assert.equal((await request('/auth/google', {
    method: 'POST',
    body: { credential: 'google-unverified-token' },
  })).status, 401);
  assert.equal((await request('/auth/login', {
    method: 'POST',
    body: { email: 'memberone@example.test', password: 'incorrect' },
  })).status, 401);
  const profile = await request('/auth/profile', { token: owner.token });
  assert.equal(profile.data.id, ownerId);
  assert.equal(profile.data.password, undefined);
  assert.equal((await request('/auth/profile', {
    token: owner.token,
    origin: 'http://127.0.0.1:5173',
  })).headers.get('access-control-allow-origin'), 'http://127.0.0.1:5173');
  assert.equal((await request('/users', { token: owner.token })).status, 403);
  const team = await request('/users', { token: admin.token });
  assert.equal(team.data.length, 3);
  assert.equal(team.data[0].password, undefined);

  const targetBody = {
    title: 'Review quarterly audit',
    audit_title: '  Audit pengadaan dan kepatuhan 2030  ',
    description: 'Review the evidence and submit findings.',
    assigned_to: ownerId,
    due_date: '2030-12-20',
    start_date: '2030-12-01',
    reviewer: 'Audit lead',
    evidence_needed: 'Signed workpapers',
    priority: 'high',
  };
  assert.equal((await request('/targets', { token: owner.token, method: 'POST', body: targetBody })).status, 403);
  assert.equal((await request('/targets', {
    token: admin.token,
    method: 'POST',
    body: { ...targetBody, assigned_to: admin.user.id },
  })).status, 400);
  assert.equal((await request('/targets', {
    token: admin.token,
    method: 'POST',
    body: { ...targetBody, due_date: '2030-02-31' },
  })).status, 400);
  assert.equal((await request('/targets', {
    token: admin.token,
    method: 'POST',
    body: { ...targetBody, start_date: '2030-12-21' },
  })).status, 400);
  for (const auditTitle of ['x'.repeat(201), 42, { title: 'Invalid title' }]) {
    const invalidAuditTitle = await request('/targets', {
      token: admin.token,
      method: 'POST',
      body: { ...targetBody, audit_title: auditTitle },
    });
    assert.equal(invalidAuditTitle.status, 400);
    assert.equal(invalidAuditTitle.data.code, 'INVALID_AUDIT_TITLE');
  }
  const created = await request('/targets', { token: admin.token, method: 'POST', body: targetBody });
  assert.equal(created.status, 201);
  assert.equal(created.data.assigned_name, 'Member One');
  assert.equal(created.data.reviewer, 'Audit lead');
  assert.equal(created.data.evidence_needed, 'Signed workpapers');
  assert.equal(created.data.audit_title, 'Audit pengadaan dan kepatuhan 2030');
  assert.equal(created.data.engagement_title, created.data.audit_title);
  assert.equal(created.data.engagement_id, null);
  assert.equal(created.data.program_id, null);
  const targetId = created.data.id;
  assert.equal((await request('/targets', { token: owner.token })).data[0].audit_title, created.data.audit_title);
  assert.equal((await request(`/targets/${targetId}`, { token: owner.token })).data.engagement_title, created.data.audit_title);
  const other = await login('other@example.test', memberPassword);
  assert.equal((await request('/targets', { token: other.token })).data.length, 0);
  assert.equal((await request(`/targets/${targetId}`, { token: other.token })).status, 403);
  assert.equal((await request(`/targets/${targetId}/progress`, {
    token: other.token,
    method: 'PATCH',
    body: { progress: 20 },
  })).status, 403);
  assert.equal((await request(`/targets/${targetId}/progress`, {
    token: owner.token,
    method: 'PATCH',
    body: { progress: 101 },
  })).status, 400);
  const progress = await request(`/targets/${targetId}/progress`, {
    token: owner.token,
    method: 'PATCH',
    body: { progress: 35, note: 'Evidence is being reviewed.', audit_status: 'Menunggu Data', data_progress: 70, analysis_progress: 20, workpaper_progress: 10 },
  });
  assert.equal(progress.data.status, 'in_progress');
  assert.equal(progress.data.audit_status, 'Menunggu Data');
  assert.equal(progress.data.data_progress, 70);
  assert.equal((await request(`/targets/${targetId}/progress`, {
    token: owner.token,
    method: 'PATCH',
    body: { progress: 40, audit_status: 'Terhambat' },
  })).status, 400);
  const coachingBody = { target_id: targetId, coaching_date: '2030-12-05', progress_at_coaching: 35, issue: 'Missing invoices', guidance: 'Request them from finance', follow_up: 'Contact finance', due_date: '2030-12-10', status: 'Berjalan' };
  assert.equal((await request('/coaching', { token: owner.token, method: 'POST', body: coachingBody })).status, 403);
  const coaching = await request('/coaching', { token: admin.token, method: 'POST', body: coachingBody });
  assert.equal(coaching.status, 201);
  assert.equal(coaching.data.member_name, 'Member One');
  assert.equal((await request('/coaching', { token: other.token })).data.length, 0);
  assert.equal((await request(`/coaching/${coaching.data.id}`, { token: other.token, method: 'PATCH', body: { status: 'Selesai' } })).status, 403);
  const followUp = await request(`/coaching/${coaching.data.id}`, { token: owner.token, method: 'PATCH', body: { status: 'Selesai', notes: 'Invoices received' } });
  assert.equal(followUp.status, 200);
  assert.equal(followUp.data.notes, 'Invoices received');
  assert.equal((await request('/submissions', {
    token: other.token,
    method: 'POST',
    multipart: documentForm(targetId),
  })).status, 403);
  const disguisedUpload = await request('/submissions', {
    token: owner.token,
    method: 'POST',
    multipart: disguisedDocumentForm(targetId),
  });
  assert.equal(disguisedUpload.status, 400);
  assert.equal(disguisedUpload.data.code, 'INVALID_FILE_CONTENT');

  const unicodeFilename = 'Dokumen pemeriksaan.pdf';
  const uploaded = await request('/submissions', {
    token: owner.token,
    method: 'POST',
    multipart: documentForm(targetId, unicodeFilename),
  });
  assert.equal(uploaded.status, 201);
  const submissionId = uploaded.data.id;
  const detail = await request(`/submissions/${submissionId}`, { token: admin.token });
  assert.equal(detail.data.file_name, unicodeFilename);
  assert.equal(detail.data.file_url, `/api/submissions/${submissionId}/file`);
  assert.equal(detail.data.file_path, undefined);
  assert.equal(detail.data.file_public_id, undefined);

  const comment = await request(`/comments/${submissionId}`, {
    token: admin.token,
    method: 'POST',
    body: { body: 'Please explain the second finding.' },
  });
  assert.equal(comment.status, 201);
  const commentId = comment.data.id;
  assert.equal((await request(`/comments/${submissionId}/${commentId}/replies`, {
    token: other.token,
    method: 'POST',
    body: { body: 'Unauthorized' },
  })).status, 403);
  assert.equal((await request(`/comments/${submissionId}`, { token: other.token })).status, 403);
  const reply = await request(`/comments/${submissionId}/${commentId}/replies`, {
    token: owner.token,
    method: 'POST',
    body: { body: 'The evidence is attached.' },
  });
  assert.equal(reply.status, 201);
  const discussion = await request(`/submissions/${submissionId}`, { token: admin.token });
  assert.equal(discussion.data.comments[0].replies[0].body, 'The evidence is attached.');
  assert.equal((await request(`/targets/${targetId}`, { token: owner.token })).data.submissions.length, 1);

  assert.equal((await request(`/targets/${targetId}/review`, {
    token: admin.token,
    method: 'PATCH',
    body: { status: 'completed' },
  })).status, 409);
  assert.equal((await request(`/targets/${targetId}/progress`, {
    token: owner.token,
    method: 'PATCH',
    body: { progress: 100, note: 'Ready for review.' },
  })).data.status, 'submitted');
  assert.equal((await request(`/targets/${targetId}/progress`, {
    token: owner.token,
    method: 'PATCH',
    body: { progress: 40 },
  })).status, 409);
  assert.equal((await request(`/targets/${targetId}/review`, {
    token: admin.token,
    method: 'PATCH',
    body: { status: 'revision' },
  })).status, 400);
  await request(`/targets/${targetId}/review`, {
    token: admin.token,
    method: 'PATCH',
    body: { status: 'revision', feedback: 'Clarify the conclusion.' },
  });
  await request(`/targets/${targetId}/progress`, {
    token: owner.token,
    method: 'PATCH',
    body: { progress: 100, note: 'Conclusion updated.' },
  });
  const complete = await request(`/targets/${targetId}/review`, {
    token: admin.token,
    method: 'PATCH',
    body: {
      status: 'completed', feedback: 'Approved.',
      quality_procedure_followed: true,
      quality_evidence_sufficient: true,
      quality_conclusion_reviewed: true,
    },
  });
  assert.equal(complete.data.status, 'completed');
  assert.equal((await request(`/targets/${targetId}/progress`, {
    token: owner.token,
    method: 'PATCH',
    body: { progress: 50 },
  })).status, 409);
  const stats = await request('/submissions/stats', { token: admin.token });
  assert.equal(stats.data.targetTotal, 1);
  assert.equal(stats.data.targetCompleted, 1);
  assert.equal(stats.data.targetPendingReview, 0);
  assert.equal(stats.data.totalMembers, 3);
  assert.equal(stats.data.monthly.length, 12);
  assert.equal((await request('/users', { token: admin.token })).data.find(member => member.id === ownerId).completed_targets, 1);
  assert.equal(normalizeFilename(Buffer.from(unicodeFilename, 'utf8').toString('latin1')), unicodeFilename);

  await t.test('manual audit titles preserve legacy targets and real audit grouping', async () => {
    const { audit_title, ...legacyBody } = targetBody;
    const legacy = await request('/targets', {
      token: admin.token, method: 'POST', body: legacyBody,
    });
    assert.equal(legacy.status, 201);
    assert.equal(legacy.data.audit_title, '');
    assert.equal(legacy.data.engagement_title, null);

    const { rows: programs } = await pool.query(`INSERT INTO audit_programs
      (title, start_date, due_date, created_by) VALUES ($1,$2,$3,$4) RETURNING id`,
    ['Program audit 2030', '2030-12-01', '2030-12-31', admin.user.id]);
    const { rows: engagements } = await pool.query(`INSERT INTO audit_engagements
      (program_id, title, start_date, due_date) VALUES ($1,$2,$3,$4) RETURNING id`,
    [programs[0].id, 'Judul audit dalam program', '2030-12-01', '2030-12-31']);
    const linkedBody = { ...targetBody, title: 'Grouped target', engagement_id: engagements[0].id, due_date: '2030-12-31' };
    const linked = await request('/targets', { token: admin.token, method: 'POST', body: linkedBody });
    assert.equal(linked.status, 201, JSON.stringify(linked.data));
    assert.equal(linked.data.engagement_id, engagements[0].id);
    assert.equal(linked.data.start_date, '2030-12-01');
    assert.equal(linked.data.due_date, '2030-12-31');
    assert.equal(Number.isFinite(linked.data.remaining_days), true);
    for (const outsideDates of [{ start_date: '2030-11-30' }, { due_date: '2031-01-01' }]) {
      const outside = await request('/targets', { token: admin.token, method: 'POST', body: { ...linkedBody, ...outsideDates } });
      assert.equal(outside.status, 400);
      assert.equal(outside.data.code, 'OUTSIDE_ENGAGEMENT_DATES');
    }
    const assignment = await request(`/targets/${targetId}/engagement`, {
      token: admin.token, method: 'PATCH', body: { engagement_id: engagements[0].id },
    });
    assert.equal(assignment.status, 200, JSON.stringify(assignment.data));
    const grouped = await request(`/targets/${targetId}`, { token: owner.token });
    assert.equal(grouped.status, 200);
    assert.equal(grouped.data.engagement_title, 'Judul audit dalam program');
    assert.equal(grouped.data.audit_title, created.data.audit_title);
    assert.equal(grouped.data.program_id, programs[0].id);
  });
});
