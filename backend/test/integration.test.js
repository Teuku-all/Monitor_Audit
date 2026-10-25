const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { newDb } = require('pg-mem');
const { normalizeFilename } = require('../src/utils/normalizeFilename');

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
    description: 'Review the evidence and submit findings.',
    assigned_to: ownerId,
    due_date: '2030-12-20',
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
  const created = await request('/targets', { token: admin.token, method: 'POST', body: targetBody });
  assert.equal(created.status, 201);
  assert.equal(created.data.assigned_name, 'Member One');
  const targetId = created.data.id;
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
    body: { progress: 35, note: 'Evidence is being reviewed.' },
  });
  assert.equal(progress.data.status, 'in_progress');
  assert.equal((await request('/submissions', {
    token: other.token,
    method: 'POST',
    multipart: documentForm(targetId),
  })).status, 403);

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
  assert.match(detail.data.file_path, /^https:\/\/cloudinary\.test\//);

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
    body: { status: 'completed', feedback: 'Approved.' },
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
});
