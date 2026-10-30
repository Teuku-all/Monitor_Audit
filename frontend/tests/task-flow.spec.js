import { test as base, expect } from '@playwright/test';

// Synthetic API and document fixtures: these browser tests never use production data.
const member = { id: 2, name: 'Bima Pratama', email: 'bima@example.test', role: 'member' };
const admin = { id: 1, name: 'Admin Audit', email: 'admin@example.test', role: 'admin' };
const members = [member, { id: 3, name: 'Nadia Putri', email: 'nadia@example.test', role: 'member' }];
const initialTarget = {
  id: 1, title: 'Audit pengadaan barang dan jasa', description: 'Periksa kesesuaian transaksi dengan kontrak dan anggaran.',
  assigned_to: 2, assigned_name: member.name, assigned_team: 'Bima Pratama, Nadia Putri', created_by_name: admin.name,
  start_date: '2030-10-20', due_date: '2030-11-15', updated_at: '2030-10-29T08:00:00Z', priority: 'high',
  status: 'in_progress', progress: 50, audit_status: 'Berjalan', schedule_status: 'green',
  data_progress: 75, analysis_progress: 50, workpaper_progress: 25, note: 'Pengujian sedang berlangsung.',
  role_assignments: [
    { id: 101, user_id: 2, member_name: member.name, role_name: 'Analisis Data', progress: 50, work_target: 'Analisis transaksi pengadaan dan dokumentasikan hasil pengujian.', required_documents: 'Daftar transaksi\nBukti pembayaran' },
    { id: 102, user_id: 3, member_name: 'Nadia Putri', role_name: 'Pengumpulan Data', progress: 50, work_target: 'Kumpulkan bukti pengadaan.', required_documents: 'Daftar kontrak' },
  ],
  drive_documents: [{ id: 10, title: 'Referensi pengadaan', drive_url: 'https://drive.google.com/drive/folders/fixture' }],
  submissions: [{ id: 8, title: 'Kertas kerja pengujian', file_name: 'pengujian.pdf', status: 'Menunggu', submitted_at: '2030-10-28T08:00:00Z', preview_url: '/api/submissions/8/preview' }],
  data_requests: [], work_logs: [], progress_history: [],
};
const files = [
  { id: 'fileA', name: 'Laporan anggaran.pdf', mimeType: 'application/pdf' },
  { id: 'fileB', name: 'Daftar transaksi', mimeType: 'application/vnd.google-apps.spreadsheet' },
];
const previewHtml = '<html><body style="font-family:sans-serif;padding:24px"><h1>Dokumen contoh</h1><p>Fixture pratinjau untuk pengujian UI.</p></body></html>';

const test = base.extend({
  workspace: async ({ page }, use) => {
    const state = { actor: member, target: structuredClone(initialTarget), failures: new Set(), writes: [], empty: false, errors: [] };
    page.on('pageerror', error => state.errors.push(error.message));
    await page.route('**/api/**', async route => {
      const request = route.request(); const pathname = new URL(request.url()).pathname;
      if (!pathname.startsWith('/api/')) return route.continue(); // Do not intercept the /src/api/axios.js module.
      const method = request.method(); const body = request.postDataJSON();
      const key = `${method} ${pathname}`;
      if (method !== 'GET') state.writes.push({ key, body });
      const respond = (data, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(data) });
      if (state.failures.has(key)) return respond({ message: 'Penyimpanan atau pemuatan gagal. Coba lagi.' }, 503);
      if (pathname === '/api/auth/profile') return respond(state.actor);
      if (pathname === '/api/users') return respond(members);
      if (pathname === '/api/engagements') return respond([]);
      if (pathname === '/api/targets' && method === 'GET') return respond(state.empty ? [] : [state.target]);
      if (pathname === '/api/targets' && method === 'POST') return respond({ ...body, id: 1, status: 'assigned', progress: 0 }, 201);
      if (pathname === '/api/targets/1' && method === 'GET') return respond(state.target);
      if (/\/documents\/\d+\/files$/.test(pathname)) return respond({ files });
      if (/\/roles\/\d+\/progress$/.test(pathname)) {
        const role = state.target.role_assignments.find(item => item.id === Number(pathname.split('/').at(-2)));
        role.progress = body.progress;
        state.target.progress = Math.round(state.target.role_assignments.reduce((sum, item) => sum + item.progress, 0) / state.target.role_assignments.length);
        state.target.status = state.target.progress === 100 ? 'submitted' : 'in_progress';
        state.target.progress_history.unshift({ id: 1, member_name: member.name, progress: state.target.progress, note: 'Progres terbaru tersimpan', created_at: '2030-10-29T08:00:00Z' });
        return respond({ role_id: role.id, role_progress: role.progress, progress: state.target.progress, status: state.target.status, audit_status: state.target.audit_status });
      }
      if (pathname.endsWith('/roles') && method === 'PUT') {
        state.target.role_assignments = body.role_assignments.map((role, index) => ({ ...role, id: role.id || 201 + index, member_name: members.find(item => item.id === role.user_id)?.name }));
        return respond(state.target);
      }
      if (pathname.endsWith('/progress') && method === 'PATCH') { Object.assign(state.target, body); return respond(state.target); }
      if (pathname.endsWith('/review')) { Object.assign(state.target, { status: body.status, feedback: body.feedback, completed_at: body.status === 'completed' ? '2030-10-29T08:00:00Z' : null }); return respond(state.target); }
      if (pathname.endsWith('/documents') && method === 'POST') { const doc = { ...body, id: 20 + state.target.drive_documents.length }; state.target.drive_documents.push(doc); return respond(doc, 201); }
      if (/\/documents\/\d+$/.test(pathname) && method === 'DELETE') { state.target.drive_documents = state.target.drive_documents.filter(doc => doc.id !== Number(pathname.split('/').at(-1))); return route.fulfill({ status: 204 }); }
      if (pathname.endsWith('/data-requests') && method === 'POST') { const item = { ...body, id: 1, status: 'requested' }; state.target.data_requests.push(item); return respond(item, 201); }
      if (pathname.endsWith('/work-logs') && method === 'POST') { const item = { ...body, id: 1, member_name: member.name }; state.target.work_logs.push(item); return respond(item, 201); }
      if (/\/data-requests\/\d+$/.test(pathname) && method === 'PATCH') { Object.assign(state.target.data_requests[0], body); return respond(state.target.data_requests[0]); }
      if (pathname.endsWith('/preview')) return route.fulfill({ contentType: 'text/html', body: previewHtml });
      return respond([], 200);
    });
    await page.route(/^https:\/\/(drive|docs)\.google\.com\//, route => route.fulfill({ contentType: 'text/html', body: previewHtml }));
    await use(state);
    expect(state.errors).toEqual([]);
  },
});

async function openOwnRole(page) { await page.goto('/member/targets/1?role=101'); await expect(page.getByRole('heading', { name: 'Analisis Data', exact: true })).toBeVisible(); }
async function assertNoOverflow(page) { expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true); }

test('task list, search, overall progress and role drill-down', async ({ page, workspace }) => {
  await page.goto('/member/targets');
  await expect(page.getByRole('heading', { name: 'Daftar tugas', exact: true })).toBeVisible();
  await expect(page.locator('.task-table [role="progressbar"]')).toHaveAttribute('aria-valuenow', '50');
  await page.getByRole('textbox', { name: 'Cari tugas atau anggota' }).fill('tidak ditemukan');
  await expect(page.getByText('Tidak ada tugas yang cocok')).toBeVisible();
  await page.getByRole('button', { name: 'Reset pencarian' }).click();
  await page.getByRole('link', { name: /Lihat peran:/ }).click();
  await expect(page.locator('.task-role-row')).toHaveCount(2);
  await expect(page.getByText(workspace.target.role_assignments[0].work_target, { exact: true })).toHaveCount(0);
  await page.locator('.task-role-row').filter({ hasText: 'Analisis Data' }).click();
  await expect(page.getByText(workspace.target.role_assignments[0].work_target, { exact: true })).toBeVisible();
  await page.goBack(); await expect(page.locator('.task-role-row')).toHaveCount(2);
  await assertNoOverflow(page);
});

test('progress failure keeps draft and retry refreshes history', async ({ page, workspace }) => {
  await openOwnRole(page);
  await page.getByRole('button', { name: '75%', exact: true }).click();
  workspace.failures.add('PATCH /api/targets/1/roles/101/progress');
  await page.getByRole('button', { name: 'Simpan progres', exact: true }).click();
  await expect(page.getByRole('alert')).toBeVisible(); await expect(page.locator('#role-progress')).toHaveValue('75');
  workspace.failures.clear(); await page.getByRole('button', { name: 'Simpan progres', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Progres subtugas berhasil disimpan' })).toBeVisible();
  await page.getByRole('tab', { name: 'Aktivitas tugas' }).click(); await expect(page.getByText('Progres terbaru tersimpan')).toBeVisible();
});

test('other member role is read-only including activity controls', async ({ page, workspace }) => {
  await page.goto('/member/targets/1?role=102');
  await expect(page.getByText('Lihat saja', { exact: true })).toBeVisible();
  await expect(page.locator('#role-progress')).toHaveCount(0);
  await page.getByRole('tab', { name: 'Aktivitas tugas' }).click(); await expect(page.locator('.monitoring-panels form')).toHaveCount(0);
  await page.getByRole('tab', { name: 'Dokumen', exact: true }).click(); await expect(page.getByRole('link', { name: 'Kirim kertas kerja' })).toHaveCount(0);
  expect(workspace.writes).toEqual([]);
});

test('saved work log and data request survive tab changes', async ({ page, workspace }) => {
  await openOwnRole(page); await page.getByRole('tab', { name: 'Aktivitas tugas' }).click();
  await page.locator('.work-log-form input[type="number"]').fill('2');
  await page.getByRole('textbox', { name: 'Pekerjaan yang dilakukan', exact: true }).fill('Menelaah bukti transaksi');
  await page.locator('.work-log-form button').click(); await expect(page.getByText('Menelaah bukti transaksi')).toBeVisible();
  await page.getByLabel('Data / dokumen yang diminta', { exact: false }).fill('Bukti kontrak tambahan');
  await page.getByLabel('PIC auditee', { exact: false }).fill('Tim pengadaan');
  await page.getByLabel('Tenggat data', { exact: false }).fill('2030-12-31');
  await page.getByRole('button', { name: 'Catat permintaan', exact: true }).click();
  await expect(page.getByText('Bukti kontrak tambahan', { exact: true })).toBeVisible();
  await page.getByRole('tab', { name: 'Ringkasan peran' }).click(); await page.getByRole('tab', { name: 'Aktivitas tugas' }).click();
  await expect(page.getByText('Menelaah bukti transaksi')).toBeVisible(); await expect(page.getByText('Bukti kontrak tambahan', { exact: true })).toBeVisible();
});

test('unsaved audit notes survive an unrelated progress save', async ({ page, workspace }) => {
  await openOwnRole(page); await page.locator('.task-context>summary').click(); await page.locator('.task-audit-editor>summary').click();
  await page.getByRole('textbox', { name: 'Catatan progres', exact: true }).fill('Catatan belum disimpan');
  await page.getByRole('button', { name: '75%', exact: true }).click(); await page.getByRole('button', { name: 'Simpan progres', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Progres subtugas berhasil disimpan' })).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Catatan progres', exact: true })).toHaveValue('Catatan belum disimpan');
  await page.getByRole('button', { name: 'Simpan rincian tugas' }).click(); await expect(page.getByText('Rincian tugas berhasil disimpan.')).toBeVisible();
  await page.getByRole('tab', { name: 'Dokumen', exact: true }).click(); await expect(page.locator('.td-file-row')).toHaveCount(2);
});

test('Drive retry, inline previews, uploaded preview and upload link', async ({ page, workspace }) => {
  workspace.failures.add('GET /api/targets/1/documents/10/files'); await openOwnRole(page);
  await page.getByRole('tab', { name: 'Dokumen', exact: true }).click(); await expect(page.getByRole('button', { name: 'Coba lagi', exact: true })).toBeVisible();
  workspace.failures.clear(); await page.getByRole('button', { name: 'Coba lagi', exact: true }).click(); await page.locator('.td-file-row').first().click();
  await expect(page.locator('.td-file-item').first().locator('.td-preview')).toBeVisible();
  const preview = await page.locator('.td-preview').boundingBox(); const nextRow = await page.locator('.td-file-row').nth(1).boundingBox(); expect(nextRow.y).toBeGreaterThanOrEqual(preview.y + preview.height);
  await page.locator('.td-file-row').nth(1).click(); await expect(page.locator('.td-file-item').first().locator('.td-preview')).toHaveCount(0);
  await page.locator('.td-workpaper-actions button').click(); await expect(page.locator('.td-workpaper iframe')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Kirim kertas kerja' })).toHaveAttribute('href', '/member/upload?target=1');
  await assertNoOverflow(page);
});

test('admin adds, edits and removes roles while preserving the detail view', async ({ page, workspace }) => {
  workspace.actor = admin; await page.goto('/admin/targets/1'); await page.getByRole('button', { name: 'Tambah peran', exact: true }).click();
  await page.getByLabel('Nama peran', { exact: false }).fill('Pelaporan'); await page.getByLabel('Anggota penanggung jawab', { exact: false }).selectOption('2');
  await page.getByRole('button', { name: 'Tambahkan peran', exact: true }).click(); await expect(page.getByRole('heading', { name: 'Pelaporan', exact: true })).toBeVisible();
  const roleUrl = page.url(); await page.getByRole('button', { name: 'Edit peran', exact: true }).click();
  await page.getByLabel('Nama peran', { exact: false }).fill('Pelaporan hasil'); workspace.failures.add('PUT /api/targets/1/roles');
  await page.getByRole('button', { name: 'Simpan perubahan', exact: true }).click(); await expect(page.getByRole('alert')).toBeVisible(); await expect(page.getByLabel('Nama peran', { exact: false })).toHaveValue('Pelaporan hasil');
  workspace.failures.clear(); await page.getByRole('button', { name: 'Simpan perubahan', exact: true }).click(); await expect(page.getByRole('heading', { name: 'Pelaporan hasil', exact: true })).toBeVisible(); expect(page.url()).toBe(roleUrl);
  await page.getByRole('button', { name: 'Edit peran', exact: true }).click(); await page.getByRole('button', { name: 'Hapus peran', exact: true }).click(); await page.getByRole('button', { name: 'Ya, hapus peran' }).click(); await expect(page.locator('.task-role-row')).toHaveCount(2);
});

test('admin requests revision, member resubmits100, admin confirms completion', async ({ page, workspace }) => {
  workspace.actor = admin; workspace.target.status = 'submitted'; workspace.target.progress = 100; workspace.target.role_assignments.forEach(role => { role.progress = 100; });
  await page.goto('/admin/targets/1'); await page.locator('.task-review summary').click();
  await expect(page.getByRole('button', { name: 'Konfirmasi selesai', exact: true })).toBeDisabled();
  await page.getByLabel('Catatan untuk anggota').fill('Lengkapi bukti pendukung'); await page.getByRole('button', { name: 'Minta revisi', exact: true }).click();
  await expect(page.getByText('Tugas dikembalikan kepada anggota untuk revisi.')).toBeVisible();
  workspace.actor = member; await openOwnRole(page); await expect(page.locator('.task-revision-note')).toContainText('Lengkapi bukti pendukung');
  await page.getByRole('button', { name: 'Kirim ulang progres', exact: true }).click(); await expect(page.getByText('Menunggu konfirmasi admin', { exact: true })).toBeVisible();
  workspace.actor = admin; await page.goto('/admin/targets/1'); await page.locator('.task-review summary').click();
  for (const checkbox of await page.locator('.task-review input[type="checkbox"]').all()) await checkbox.check();
  await page.getByRole('button', { name: 'Konfirmasi selesai', exact: true }).click(); await expect(page.getByText('Tugas telah dikonfirmasi selesai oleh admin')).toBeVisible(); await expect(page.getByRole('button', { name: 'Tambah peran', exact: true })).toHaveCount(0);
});

test('three-step creation validates duplicates and retries folders without duplicating task', async ({ page, workspace }) => {
  workspace.actor = admin; await page.goto('/admin/targets?create=1'); await page.locator('#target-title').fill('Audit persediaan'); await page.locator('#target-due').fill('2030-12-31'); await page.getByRole('button', { name: 'Lanjut', exact: true }).click();
  await page.locator('#role-member-0').selectOption('2'); await page.getByRole('button', { name: 'Tambah peran anggota', exact: true }).click(); await page.locator('#role-name-1').fill('Pelaksana'); await page.locator('#role-member-1').selectOption('2');
  await page.getByRole('button', { name: 'Lanjut', exact: true }).click(); await expect(page.getByRole('alert')).toContainText('tidak boleh ditambahkan dua kali');
  await page.locator('#role-name-1').fill('Pemeriksaan fisik'); await page.getByRole('button', { name: 'Lanjut', exact: true }).click();
  await page.getByRole('button', { name: 'Tambah folder Google Drive' }).click(); await page.locator('#folder-title-0').fill('Referensi'); await page.locator('#folder-url-0').fill('https://drive.google.com/drive/folders/fixture');
  workspace.failures.add('POST /api/targets/1/documents'); await page.getByRole('button', { name: 'Buat & bagikan tugas' }).click(); await expect(page.getByRole('alert')).toContainText('Tugas berhasil dibuat');
  workspace.failures.clear(); await page.getByRole('button', { name: 'Simpan folder kembali' }).click(); await expect(page.getByRole('dialog')).toHaveCount(0); expect(workspace.writes.filter(item => item.key === 'POST /api/targets')).toHaveLength(1);
});

test('member lookup failures show retry instead of misleading empty state', async ({ page, workspace }) => {
  workspace.actor = admin; workspace.failures.add('GET /api/users'); await page.goto('/admin/targets?create=1');
  await expect(page.getByRole('dialog').getByRole('button', { name: 'Coba lagi', exact: true })).toBeVisible(); await expect(page.getByText('Tambahkan anggota terlebih dahulu')).toHaveCount(0);
  workspace.failures.clear(); await page.getByRole('dialog').getByRole('button', { name: 'Coba lagi', exact: true }).click(); await expect(page.locator('#target-title')).toBeVisible();
});

test('empty documents, keyboard tabs, dark mode and narrow layout', async ({ page, workspace }, testInfo) => {
  workspace.target.drive_documents = []; workspace.target.submissions = [];
  await page.addInitScript(() => localStorage.setItem('audit-theme', 'dark'));
  await openOwnRole(page); await page.getByRole('tab', { name: 'Ringkasan peran' }).focus(); await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('tab', { name: 'Dokumen', exact: true })).toHaveAttribute('aria-selected', 'true'); await expect(page.getByText('Belum ada dokumen referensi')).toBeVisible(); await expect(page.getByText('Belum ada kertas kerja', { exact: true })).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark'); await assertNoOverflow(page);
  await page.screenshot({ path: testInfo.outputPath('documents-empty-dark.png'), fullPage: true });
  if (testInfo.project.name === 'mobile') { await page.setViewportSize({ width: 320, height: 740 }); await assertNoOverflow(page); }
});

test('task load error can be retried and empty task list is understandable', async ({ page, workspace }) => {
  workspace.failures.add('GET /api/targets/1'); await page.goto('/member/targets/1'); await expect(page.getByRole('button', { name: 'Coba lagi', exact: true })).toBeVisible();
  workspace.failures.clear(); await page.getByRole('button', { name: 'Coba lagi', exact: true }).click(); await expect(page.locator('.task-role-row')).toHaveCount(2);
  workspace.empty = true; await page.goto('/member/targets'); await expect(page.getByText('Belum ada target di sini')).toBeVisible();
});

test('mobile quick navigation and drawer preserve keyboard focus', async ({ page, workspace }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile', 'Phone navigation only');
  await page.goto('/member/targets');
  const quickNav = page.getByRole('navigation', { name: 'Navigasi cepat' });
  await expect(quickNav.getByRole('link', { name: 'Tugas', exact: true })).toHaveAttribute('aria-current', 'page');
  const more = quickNav.getByRole('button', { name: 'Buka menu lainnya' });
  await more.click();
  const drawer = page.getByRole('dialog', { name: 'Menu navigasi' });
  await expect(drawer).toBeVisible();
  await expect(drawer.getByRole('button', { name: 'Tutup menu' })).toBeFocused();
  await drawer.getByRole('button', { name: 'Keluar' }).focus();
  await page.keyboard.press('Tab');
  await expect(drawer.getByRole('link', { name: /SIGAP/ })).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(drawer.getByRole('button', { name: 'Keluar' })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(more).toBeFocused();
  await expect(drawer).toHaveCount(0);
  await quickNav.getByRole('link', { name: 'Dokumen', exact: true }).click();
  await expect(page).toHaveURL(/\/member\/submissions$/);
  await page.setViewportSize({ width: 320, height: 740 });
  await assertNoOverflow(page);
  await more.click();
  await page.setViewportSize({ width: 1024, height: 768 });
  await expect(page.getByRole('dialog', { name: 'Menu navigasi' })).toHaveCount(0);
  await expect(page.locator('.workspace')).not.toHaveAttribute('inert', '');
});

test('document cards keep their open action reachable on phones', async ({ page, workspace }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile', 'Phone document cards only');
  await page.route('**/api/submissions/mine', route => route.fulfill({ contentType: 'application/json', body: JSON.stringify(initialTarget.submissions) }));
  await page.goto('/member/submissions');
  const openDocument = page.getByRole('link', { name: 'Buka dokumen: Kertas kerja pengujian' });
  await expect(openDocument).toBeVisible();
  await openDocument.scrollIntoViewIfNeeded();
  const rect = await openDocument.boundingBox();
  expect(rect.height).toBeGreaterThanOrEqual(44);
  const navRect = await page.locator('.mobile-bottom-nav').boundingBox();
  expect(rect.y + rect.height).toBeLessThanOrEqual(navRect.y);
  await expect(openDocument).toHaveAttribute('href', '/member/submissions/8');
});

test('task table stays within the page at phone and tablet widths', async ({ page, workspace }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'Checks responsive widths in one browser');
  workspace.actor = admin;
  await page.goto('/admin/targets');
  await expect(page.locator('.task-table .table-title')).toHaveText(initialTarget.title);
  for (const width of [320, 768, 1024]) {
    await page.setViewportSize({ width, height: 844 });
    await assertNoOverflow(page);
  }
});
