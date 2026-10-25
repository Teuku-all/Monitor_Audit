const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { fork } = require('node:child_process');
const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const { normalizeFilename } = require('../src/utils/normalizeFilename');

const backendRoot = path.resolve(__dirname, '..');
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-monitor-integration-'));
let child, base;
const adminPassword = 'integration-admin-password';
const memberPassword = 'member-password-123';

async function start() {
  child = fork(path.join(backendRoot, 'server.js'), [], {
    cwd: os.tmpdir(),
    env: { ...process.env, NODE_ENV: 'test', PORT: '0', DB_PATH: path.relative(backendRoot, path.join(temp, 'database.db')), UPLOAD_DIR: path.join(temp, 'uploads'), JWT_SECRET: 'isolated-integration-test-secret', ADMIN_EMAIL: 'admin@example.test', ADMIN_PASSWORD: adminPassword },
    stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
  });
  let logs = '';
  child.stdout.on('data', value => { logs += value; });
  child.stderr.on('data', value => { logs += value; });
  base = await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error(`Server did not start: ${logs}`)), 12000);
    child.once('message', message => { clearTimeout(timeout); resolve(`http://127.0.0.1:${message.port}`); });
    child.once('exit', code => { clearTimeout(timeout); reject(new Error(`Server exited ${code}: ${logs}`)); });
  });
}
async function stop() {
  if (!child || child.exitCode !== null) return;
  const exited = new Promise(resolve => child.once('exit', resolve));
  child.kill();
  await exited;
}
async function request(route, { token, method = 'GET', body, multipart, origin } = {}) {
  const response = await fetch(`${base}/api${route}`, {
    method,
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}), ...(origin ? { Origin: origin } : {}) },
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

test('persistent accounts, targets, permissions, documents and comment replies', async t => {
  const unicodeFilename = 'Документ проверки.pdf';
  const legacyMojibake = Buffer.from(unicodeFilename, 'utf8').toString('latin1');
  assert.equal(normalizeFilename(legacyMojibake), unicodeFilename);
  t.after(async () => {
    await stop();
    // temp is the exact directory created by mkdtemp for this isolated test.
    fs.rmSync(temp, { recursive: true, force: true });
  });
  // Begin with the previous schema. Startup must add target support without replacing accounts.
  const legacy = new Database(path.join(temp, 'database.db'));
  legacy.exec(`
    CREATE TABLE users (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL, password TEXT NOT NULL, role TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE submissions (id INTEGER PRIMARY KEY AUTOINCREMENT, member_id INTEGER NOT NULL REFERENCES users(id),
      title TEXT NOT NULL, description TEXT, file_path TEXT NOT NULL, file_name TEXT NOT NULL,
      status TEXT DEFAULT 'Menunggu', submitted_at DATETIME DEFAULT CURRENT_TIMESTAMP);
  `);
  legacy.prepare('INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)').run(
    'Existing Administrator', 'admin@example.test', bcrypt.hashSync(adminPassword, 10), 'admin'
  );
  legacy.close();
  await start();
  let admin = await login('admin@example.test', adminPassword);
  assert.equal(admin.user.name, 'Existing Administrator');
  assert.equal((await request('/users')).status, 401);
  const signup = await request('/auth/register', { method: 'POST', body: { name: 'Member One', email: '  MemberOne@Example.test ', password: memberPassword, role: 'admin' } });
  assert.equal(signup.status, 201);
  const ownerId = signup.data.userId;
  assert.equal((await request('/auth/register', { method: 'POST', body: { name: 'Duplicate', email: 'MEMBERONE@example.test', password: memberPassword } })).status, 409);
  assert.equal((await request('/auth/register', { method: 'POST', body: { name: 'Invalid', email: 'invalid', password: memberPassword } })).status, 400);
  assert.equal((await request('/auth/register', { method: 'POST', body: { name: 'Invalid', email: 'short@example.test', password: 'short' } })).status, 400);
  await request('/auth/register', { method: 'POST', body: { name: 'Member Two', email: 'other@example.test', password: memberPassword } });
  let owner = await login('MEMBERONE@EXAMPLE.TEST', memberPassword);
  assert.equal(owner.user.role, 'member');
  assert.equal((await request('/auth/login', { method: 'POST', body: { email: 'memberone@example.test', password: 'incorrect' } })).status, 401);
  // A new process must load the same account from disk with the normalized email.
  await stop();
  await start();
  owner = await login('memberone@example.test', memberPassword);
  admin = await login('admin@example.test', adminPassword);
  const other = await login('other@example.test', memberPassword);
  const profile = await request('/auth/profile', { token: owner.token });
  assert.equal(profile.data.id, ownerId);
  assert.equal(profile.data.password, undefined);
  assert.equal((await request('/auth/profile', { token: owner.token, origin: 'http://127.0.0.1:5173' })).headers.get('access-control-allow-origin'), 'http://127.0.0.1:5173');
  assert.equal((await request('/users', { token: owner.token })).status, 403);
  const team = await request('/users', { token: admin.token });
  assert.equal(team.data.length, 2);
  assert.equal(team.data[0].password, undefined);
  const targetBody = { title: 'Review quarterly audit', description: 'Review the evidence and submit findings.', assigned_to: ownerId, due_date: '2030-12-20', priority: 'high' };
  assert.equal((await request('/targets', { token: owner.token, method: 'POST', body: targetBody })).status, 403);
  assert.equal((await request('/targets', { token: admin.token, method: 'POST', body: { ...targetBody, assigned_to: admin.user.id } })).status, 400);
  assert.equal((await request('/targets', { token: admin.token, method: 'POST', body: { ...targetBody, due_date: '2030-02-31' } })).status, 400);
  const created = await request('/targets', { token: admin.token, method: 'POST', body: targetBody });
  assert.equal(created.status, 201);
  assert.equal(created.data.assigned_name, 'Member One');
  const targetId = created.data.id;
  assert.equal((await request('/targets', { token: other.token })).data.length, 0);
  assert.equal((await request(`/targets/${targetId}`, { token: other.token })).status, 403);
  assert.equal((await request(`/targets/${targetId}/progress`, { token: other.token, method: 'PATCH', body: { progress: 20 } })).status, 403);
  assert.equal((await request(`/targets/${targetId}/progress`, { token: owner.token, method: 'PATCH', body: { progress: 101 } })).status, 400);
  const progress = await request(`/targets/${targetId}/progress`, { token: owner.token, method: 'PATCH', body: { progress: 35, note: 'Evidence is being reviewed.' } });
  assert.equal(progress.data.status, 'in_progress');
  // Linked documents and discussions retain the same owner boundary.
  assert.equal((await request('/submissions', { token: other.token, method: 'POST', multipart: documentForm(targetId) })).status, 403);
  const uploaded = await request('/submissions', { token: owner.token, method: 'POST', multipart: documentForm(targetId, unicodeFilename) });
  assert.equal(uploaded.status, 201);
  const submissionId = uploaded.data.id;
  const comment = await request(`/comments/${submissionId}`, { token: admin.token, method: 'POST', body: { body: 'Please explain the second finding.' } });
  assert.equal(comment.status, 201);
  const commentId = comment.data.id;
  assert.equal((await request(`/comments/${submissionId}/${commentId}/replies`, { token: other.token, method: 'POST', body: { body: 'Unauthorized' } })).status, 403);
  assert.equal((await request(`/comments/${submissionId}`, { token: other.token })).status, 403);
  const reply = await request(`/comments/${submissionId}/${commentId}/replies`, { token: owner.token, method: 'POST', body: { body: 'The evidence is attached.' } });
  assert.equal(reply.status, 201);
  const detail = await request(`/submissions/${submissionId}`, { token: admin.token });
  assert.equal(detail.data.file_name, unicodeFilename);
  assert.equal(detail.data.comments[0].replies[0].body, 'The evidence is attached.');
  assert.equal((await request(`/targets/${targetId}`, { token: owner.token })).data.submissions.length, 1);
  assert.equal((await request(`/targets/${targetId}/review`, { token: admin.token, method: 'PATCH', body: { status: 'completed' } })).status, 409);
  assert.equal((await request(`/targets/${targetId}/progress`, { token: owner.token, method: 'PATCH', body: { progress: 100, note: 'Ready for review.' } })).data.status, 'submitted');
  assert.equal((await request(`/targets/${targetId}/progress`, { token: owner.token, method: 'PATCH', body: { progress: 40 } })).status, 409);
  assert.equal((await request(`/targets/${targetId}/review`, { token: owner.token, method: 'PATCH', body: { status: 'completed' } })).status, 403);
  assert.equal((await request(`/targets/${targetId}/review`, { token: admin.token, method: 'PATCH', body: { status: 'revision' } })).status, 400);
  const revision = await request(`/targets/${targetId}/review`, { token: admin.token, method: 'PATCH', body: { status: 'revision', feedback: 'Clarify the conclusion.' } });
  assert.equal(revision.data.status, 'revision');
  assert.equal((await request(`/targets/${targetId}/progress`, { token: owner.token, method: 'PATCH', body: { progress: 100, note: 'Conclusion updated.' } })).data.status, 'submitted');
  const complete = await request(`/targets/${targetId}/review`, { token: admin.token, method: 'PATCH', body: { status: 'completed', feedback: 'Approved.' } });
  assert.equal(complete.data.status, 'completed');
  assert.equal((await request(`/targets/${targetId}/progress`, { token: owner.token, method: 'PATCH', body: { progress: 50 } })).status, 409);
  const stats = await request('/submissions/stats', { token: admin.token });
  assert.equal(stats.data.targetTotal, 1);
  assert.equal(stats.data.targetCompleted, 1);
  assert.equal(stats.data.targetPendingReview, 0);
  assert.equal(stats.data.totalMembers, 2);
  assert.equal(stats.data.monthly.length, 12);
  assert.equal(stats.data.monthly.at(-1).submitted, 1);
  assert.equal((await request('/users', { token: admin.token })).data.find(member => member.id === ownerId).completed_targets, 1);
  await stop();
  await start();
  const persisted = await request(`/targets/${targetId}`, { token: admin.token });
  assert.equal(persisted.data.status, 'completed');
  assert.equal(persisted.data.note, 'Conclusion updated.');
});
