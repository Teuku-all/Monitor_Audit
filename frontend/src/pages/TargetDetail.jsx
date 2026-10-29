import { useEffect, useRef, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import StatusBadge from '../components/StatusBadge';
import { Priority, ProgressBar } from '../components/TargetTable';
import { ErrorState, LoadingState } from '../components/States';
import Icon from '../components/Icon';
import { DataRequestPanel, WorkLogPanel, ProgressHistoryPanel } from '../components/TargetMonitoringPanels';
import TargetDocuments from '../components/TargetDocuments';
import './TargetDetail.css';

const roleKey = role => String(role.id ?? `legacy-${role.user_id}`);
const qualityKeys = ['quality_procedure_followed', 'quality_evidence_sufficient', 'quality_conclusion_reviewed'];
const auditKeys = ['audit_status', 'data_progress', 'analysis_progress', 'workpaper_progress', 'blocker', 'blocker_impact', 'follow_up', 'evidence_needed', 'note'];

export default function TargetDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const { t, formatDate } = useLanguage();
  const [params, setParams] = useSearchParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [tab, setTab] = useState('overview');
  const [editing, setEditing] = useState(false);
  const [adding, setAdding] = useState(false);
  const [members, setMembers] = useState([]);
  const [membersFailed, setMembersFailed] = useState(false);
  const [membersLoading, setMembersLoading] = useState(false);
  const [memberAttempt, setMemberAttempt] = useState(0);
  const [notice, setNotice] = useState('');
  const admin = user?.role === 'admin';
  const base = admin ? '/admin' : '/member';
  const selectedKey = params.get('role');
  const roles = data?.role_assignments || [];
  const selectedRole = roles.find(role => roleKey(role) === selectedKey);
  const ownRole = selectedRole && Number(selectedRole.user_id) === Number(user?.id);
  const editable = !admin && ownRole && !['submitted', 'completed'].includes(data?.status);
  const canManageRoles = admin && !['submitted', 'completed'].includes(data?.status);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setFailed(false);
    api.get(`/targets/${id}`, { signal: controller.signal }).then(({ data: next }) => setData(next))
      .catch(() => { if (!controller.signal.aborted) setFailed(true); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [id, attempt]);

  useEffect(() => { setTab('overview'); setEditing(false); setAdding(false); setNotice(''); }, [id, selectedKey]);
  useEffect(() => {
    if (!admin || (!editing && !adding)) return;
    const controller = new AbortController();
    setMembersLoading(true); setMembersFailed(false);
    api.get('/users', { signal: controller.signal }).then(({ data: next }) => setMembers(next))
      .catch(() => { if (!controller.signal.aborted) setMembersFailed(true); })
      .finally(() => { if (!controller.signal.aborted) setMembersLoading(false); });
    return () => controller.abort();
  }, [admin, editing, adding, memberAttempt]);

  async function acceptMutation(response) {
    if (response.role_assignments && response.title) { setData(response); return response; }
    const { data: next } = await api.get(`/targets/${id}`);
    setData(next); return next;
  }
  async function saveRoles(nextRoles) {
    const { data: result } = await api.put(`/targets/${id}/roles`, { role_assignments: nextRoles.map(role => ({
      ...(role.id ? { id: role.id } : {}), role_name: role.role_name.trim(), user_id: Number(role.user_id),
      work_target: role.work_target || '', required_documents: role.required_documents || '', progress: Number(role.progress) || 0,
    })) });
    return acceptMutation(result);
  }
  function selectRole(role) { setParams(role ? { role: roleKey(role) } : {}); }
  async function handleRoleProgress(next, role) {
    if (next.role_assignments && next.title) setData(next);
    else {
      setData(current => ({ ...current, ...next, role_assignments: current.role_assignments.map(item => item.id === role.id ? { ...item, progress: next.role_progress } : item) }));
      try { await acceptMutation(next); } catch { /* The saved progress remains visible if refreshing history fails. */ }
    }
    setNotice(t('Progres subtugas berhasil disimpan.', 'Subtask progress saved.'));
  }

  if (loading) return <LoadingState/>;
  if (failed || !data) return <div className="workspace-page"><ErrorState onRetry={() => setAttempt(value => value + 1)}/><Link className="btn-secondary" to={`${base}/targets`}>{t('Kembali ke daftar tugas', 'Back to tasks')}</Link></div>;

  const tabs = [['overview', t('Ringkasan peran', 'Role overview'), 'target'], ['documents', t('Dokumen', 'Documents'), 'file'], ['activity', t('Aktivitas tugas', 'Task activity'), 'clock']];
  const editorProps = { members, membersLoading, membersFailed, retryMembers: () => setMemberAttempt(value => value + 1) };
  return <div className="workspace-page task-workspace">
    <nav className="task-breadcrumb" aria-label={t('Lokasi halaman', 'Breadcrumb')}>
      <Link to={`${base}/targets`}>{t('Daftar tugas', 'Tasks')}</Link><Icon name="chevron" size={14}/>
      {selectedRole ? <><button onClick={() => selectRole(null)}>{data.title}</button><Icon name="chevron" size={14}/><span aria-current="page">{selectedRole.role_name}</span></> : <span aria-current="page">{data.title}</span>}
    </nav>
    <header className="task-page-header">
      <div><span className="task-eyebrow">{selectedRole ? t('Detail subtugas', 'Subtask details') : `${t('Tugas', 'Task')} #${String(data.id).padStart(3, '0')}`}</span>
        <h1>{selectedRole?.role_name || data.title}</h1>
        <p>{selectedRole ? <><Icon name="user" size={16}/>{selectedRole.member_name || t('Anggota', 'Member')}<span className={`task-access ${ownRole ? 'is-own' : ''}`}>{admin ? t('Dikelola admin', 'Admin access') : ownRole ? t('Peran Anda', 'Your role') : t('Lihat saja', 'View only')}</span></> : t('Pilih peran untuk melihat target, dokumen, dan progres pekerjaannya.', 'Choose a role to view its targets, documents, and progress.')}</p>
      </div>
      <div className="task-header-meta"><span className="task-status-label">{t('Status tugas', 'Task status')}<StatusBadge status={data.status}/></span><span><Icon name="calendar" size={15}/>{t('Tenggat', 'Due')} {formatDate(data.due_date)}</span></div>
    </header>
    {notice && <div className="alert alert-success task-feedback" role="status"><Icon name="check" size={18}/>{notice}</div>}
    {data.status === 'revision' && data.feedback && <section className="task-revision-note" aria-label={t('Catatan revisi admin', 'Admin revision notes')}><Icon name="message" size={20}/><div><strong>{t('Perbaikan yang diminta admin', 'Changes requested by the admin')}</strong><p>{data.feedback}</p></div></section>}
    {selectedKey && !selectedRole && <div className="alert" role="status">{t('Peran ini sudah berubah. Pilih kembali dari daftar peran.', 'This role has changed. Choose a role from the list.')}</div>}

    {!selectedRole ? <>
      <section className="panel task-role-list">
        <div className="task-section-heading"><div><h2>{t('Peran & subtugas', 'Roles & subtasks')}<span className="task-count">{roles.length}</span></h2><p>{t('Progres ditampilkan untuk setiap peran anggota.', 'Progress is shown for each member role.')}</p></div>{canManageRoles && <button className="btn-primary" onClick={() => setAdding(value => !value)} aria-expanded={adding}><Icon name={adding ? 'close' : 'plus'} size={16}/>{adding ? t('Tutup formulir', 'Close form') : t('Tambah peran', 'Add role')}</button>}</div>
        {adding && <RoleEditor {...editorProps} onCancel={() => setAdding(false)} onSave={async draft => { const next = await saveRoles([...roles, draft]); setAdding(false); const created = next.role_assignments.find(role => role.role_name === draft.role_name.trim() && Number(role.user_id) === Number(draft.user_id)); if (created) selectRole(created); }}/>}
        <div className="task-role-rows">{roles.map((role, index) => {
          const mine = Number(role.user_id) === Number(user?.id);
          const value = Number(role.progress) || 0;
          return <button type="button" className={`task-role-row ${mine && !admin ? 'is-own' : ''}`} key={roleKey(role)} onClick={() => selectRole(role)}>
            <span className={`task-role-avatar ${value === 100 ? 'is-complete' : ''}`}>{value === 100 ? <Icon name="check" size={20}/> : String(index + 1).padStart(2, '0')}</span>
            <span className="task-role-person"><strong>{role.role_name}</strong><span><Icon name="user" size={13}/>{role.member_name || t('Anggota', 'Member')}{mine && !admin && <small>{t('Anda', 'You')}</small>}</span></span>
            <span className={`task-role-meter ${value === 100 ? 'is-complete' : ''}`}><span>{value === 100 ? t('Target tercapai', 'Target reached') : value > 0 ? t('Sedang dikerjakan', 'In progress') : t('Belum dimulai', 'Not started')}</span><ProgressBar value={value}/></span>
            <span className="task-role-open">{t('Lihat detail', 'View details')}<Icon name="chevron" size={17}/></span>
          </button>;
        })}</div>
        {!roles.length && <div className="task-empty"><Icon name="users" size={26}/><h3>{t('Belum ada peran anggota', 'No member roles yet')}</h3><p>{admin ? t('Tambahkan peran dan tentukan anggota yang bertanggung jawab.', 'Add a role and assign a responsible member.') : t('Admin akan menambahkan peran untuk tugas ini.', 'The admin will add roles to this task.')}</p></div>}
      </section>
    </> : <>
      <div className="task-detail-toolbar"><button className="task-back" onClick={() => selectRole(null)}><Icon name="back" size={17}/>{t('Semua peran', 'All roles')}</button>{canManageRoles && <button className="btn-secondary" onClick={() => setEditing(value => !value)} aria-expanded={editing}>{editing ? t('Tutup pengaturan', 'Close settings') : t('Edit peran', 'Edit role')}</button>}</div>
      {editing && <section className="panel task-editor-panel"><RoleEditor key={roleKey(selectedRole)} {...editorProps} role={selectedRole} canRemove={roles.length > 1} onCancel={() => setEditing(false)} onSave={async draft => { const next = await saveRoles(roles.map(role => roleKey(role) === selectedKey ? { ...role, ...draft } : role)); const saved = next.role_assignments.find(role => role.id === selectedRole.id) || next.role_assignments.find(role => role.role_name === draft.role_name.trim() && Number(role.user_id) === Number(draft.user_id)); if (saved) selectRole(saved); setEditing(false); setNotice(t('Perubahan peran berhasil disimpan.', 'Role changes saved.')); }} onRemove={async () => { await saveRoles(roles.filter(role => roleKey(role) !== selectedKey)); selectRole(null); setNotice(t('Peran berhasil dihapus.', 'Role removed.')); }}/></section>}
      <div className="task-tabs" role="tablist" aria-label={t('Bagian subtugas', 'Subtask sections')} onKeyDown={event => {
        const current = tabs.findIndex(([key]) => key === tab); let next;
        if (event.key === 'ArrowRight') next = (current + 1) % tabs.length;
        if (event.key === 'ArrowLeft') next = (current + tabs.length - 1) % tabs.length;
        if (event.key === 'Home') next = 0; if (event.key === 'End') next = tabs.length - 1;
        if (next !== undefined) { event.preventDefault(); setTab(tabs[next][0]); event.currentTarget.querySelectorAll('[role="tab"]')[next].focus(); }
      }}>{tabs.map(([key, label, icon]) => <button key={key} id={`task-tab-${key}`} role="tab" aria-selected={tab === key} aria-controls={`task-panel-${key}`} tabIndex={tab === key ? 0 : -1} className={tab === key ? 'is-active' : ''} onClick={() => setTab(key)}><Icon name={icon} size={17}/>{label}</button>)}</div>
      <div id={`task-panel-${tab}`} role="tabpanel" aria-labelledby={`task-tab-${tab}`} className="task-tab-panel" tabIndex={0}>
        {tab === 'overview' && <>
          <div className="task-role-layout"><div className="task-role-main">
            <section className="panel task-info-card"><div className="task-card-title"><span className="task-section-icon"><Icon name="target" size={19}/></span><h2>{t('Target kerja', 'Work target')}</h2></div>{selectedRole.work_target ? <p className="task-long-text">{selectedRole.work_target}</p> : <p className="task-muted">{t('Admin belum menambahkan target kerja untuk peran ini.', 'The admin has not added a work target for this role yet.')}</p>}</section>
            <section className="panel task-info-card"><div className="task-card-title"><span className="task-section-icon"><Icon name="file" size={19}/></span><h2>{t('Dokumen yang dibutuhkan', 'Required documents')}</h2></div>{selectedRole.required_documents?.trim() ? <ul className="task-required-list">{selectedRole.required_documents.split(/\r?\n/).filter(line => line.trim()).map((document, index) => <li key={index}><span>{index + 1}</span>{document}</li>)}</ul> : <p className="task-muted">{t('Belum ada dokumen khusus yang diminta untuk peran ini.', 'No specific documents have been requested for this role.')}</p>}<button className="task-inline-action" onClick={() => setTab('documents')}>{t('Buka dokumen & kertas kerja', 'Open documents & workpapers')}<Icon name="arrow" size={16}/></button></section>
          </div><RoleProgress key={`${roleKey(selectedRole)}-${selectedRole.progress}`} role={selectedRole} target={data} admin={admin} ownRole={ownRole} editable={editable} onSaved={next => handleRoleProgress(next, selectedRole)}/></div>
          <TaskAuditDetails target={data} editable={editable} role={selectedRole} onSaved={async result => { await acceptMutation(result); setNotice(t('Rincian tugas berhasil disimpan.', 'Task details saved.')); }}/>
        </>}
        {tab === 'documents' && <TargetDocuments target={data} admin={admin} canUpload={editable} onChange={setData}/>}
        {tab === 'activity' && <><div className="task-activity-intro"><h2>{t('Aktivitas seluruh tugas', 'Activity across this task')}</h2><p>{t('Permintaan data, catatan kerja, dan riwayat di sini berlaku untuk seluruh tugas.', 'Data requests, work logs, and history here apply to the whole task.')}</p></div><div className="monitoring-panels"><DataRequestPanel target={data} admin={admin} readOnly={!admin && !editable} onChange={items => setData(current => ({ ...current, data_requests: items }))}/><WorkLogPanel target={data} admin={admin} readOnly={!admin && !editable} onChange={items => setData(current => ({ ...current, work_logs: items }))}/><ProgressHistoryPanel items={data.progress_history}/></div></>}
      </div>
    </>}
    {admin && data.status === 'submitted' && <TaskReview target={data} onSaved={async result => { await acceptMutation(result); setNotice(result.status === 'completed' ? t('Tugas telah dikonfirmasi selesai.', 'Task confirmed complete.') : t('Tugas dikembalikan kepada anggota untuk revisi.', 'Task returned to members for revision.')); }}/>}
    {data.status === 'completed' && <div className="task-completion-note"><Icon name="check" size={19}/><span><strong>{t('Tugas telah dikonfirmasi selesai oleh admin', 'Task completion confirmed by admin')}</strong>{data.completed_at && <small>{formatDate(data.completed_at)}</small>}</span></div>}
    {!admin && data.status === 'submitted' && <div className="task-completion-note is-pending"><Icon name="clock" size={19}/><span><strong>{t('Menunggu konfirmasi admin', 'Awaiting admin confirmation')}</strong><small>{t('Seluruh progres sudah terkirim. Admin akan meninjau hasil tugas.', 'All progress has been submitted. The admin will review the work.')}</small></span></div>}
  </div>;
}

function RoleEditor({ role, members, membersLoading, membersFailed, retryMembers, onSave, onCancel, onRemove, canRemove }) {
  const { t } = useLanguage();
  const [draft, setDraft] = useState({ role_name: role?.role_name || '', user_id: role?.user_id || '', work_target: role?.work_target || '', required_documents: role?.required_documents || '' });
  const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const [removing, setRemoving] = useState(false);
  const firstField = useRef(null);
  useEffect(() => { firstField.current?.focus(); }, []);
  async function submit(event) { event.preventDefault(); setBusy(true); setError(''); try { await onSave(draft); } catch (error) { setError(error.response?.data?.message || t('Perubahan belum tersimpan. Coba lagi.', 'Changes could not be saved. Try again.')); } finally { setBusy(false); } }
  return <form className="task-role-editor" onSubmit={submit}>
    <div><h3>{role ? t('Pengaturan peran', 'Role settings') : t('Tambah peran anggota', 'Add a member role')}</h3><p>{t('Tentukan siapa yang mengerjakan, targetnya, dan dokumen yang perlu disiapkan.', 'Assign the work, set its target, and list the documents to prepare.')}</p></div>
    {error && <div className="alert alert-error" role="alert">{error}</div>}
    <div className="task-form-columns"><label><span className="label">{t('Nama peran', 'Role name')} <span aria-hidden="true">*</span></span><input ref={firstField} className="input" required maxLength="100" value={draft.role_name} placeholder={t('Contoh: Analisis data', 'Example: Data analysis')} onChange={event => setDraft({ ...draft, role_name: event.target.value })}/></label><label><span className="label">{t('Anggota penanggung jawab', 'Assigned member')} <span aria-hidden="true">*</span></span><select className="input" required value={draft.user_id} disabled={membersLoading || membersFailed} onChange={event => setDraft({ ...draft, user_id: event.target.value })}><option value="">{membersLoading ? t('Memuat anggota…', 'Loading members…') : t('Pilih anggota', 'Choose a member')}</option>{members.map(member => <option key={member.id} value={member.id}>{member.name} · {member.email}</option>)}</select></label></div>
    {membersFailed && <div role="alert" className="task-inline-error">{t('Daftar anggota belum dapat dimuat.', 'Could not load members.')}<button type="button" className="text-link" onClick={retryMembers}>{t('Coba lagi', 'Try again')}</button></div>}
    <label><span className="label">{t('Target kerja', 'Work target')}</span><textarea className="input" rows="3" maxLength="3000" value={draft.work_target} placeholder={t('Jelaskan hasil yang perlu dicapai anggota.', 'Describe the result the member should deliver.')} onChange={event => setDraft({ ...draft, work_target: event.target.value })}/></label>
    <label><span className="label">{t('Dokumen yang dibutuhkan', 'Required documents')}</span><textarea className="input" rows="3" maxLength="3000" value={draft.required_documents} placeholder={t('Contoh: Laporan keuangan\nBukti transaksi', 'Example: Financial report\nTransaction evidence')} onChange={event => setDraft({ ...draft, required_documents: event.target.value })}/><span className="task-field-help">{t('Tulis satu dokumen pada setiap baris.', 'Enter one document per line.')}</span></label>
    <div className="task-form-actions">{canRemove && <button type="button" className="task-danger-link" onClick={() => setRemoving(value => !value)} disabled={busy}>{t('Hapus peran', 'Remove role')}</button>}<span/><button type="button" className="btn-secondary" onClick={onCancel} disabled={busy}>{t('Batal', 'Cancel')}</button><button className="btn-primary" disabled={busy || membersLoading || membersFailed}>{busy ? t('Menyimpan…', 'Saving…') : role ? t('Simpan perubahan', 'Save changes') : t('Tambahkan peran', 'Add role')}</button></div>
    {removing && <div className="task-remove-confirm"><p>{t('Hapus peran ini beserta progresnya dari tugas?', 'Remove this role and its progress from the task?')}</p><button type="button" className="btn-secondary" disabled={busy} onClick={() => setRemoving(false)}>{t('Pertahankan peran', 'Keep role')}</button><button type="button" className="task-danger-button" disabled={busy} onClick={async () => { setBusy(true); setError(''); try { await onRemove(); } catch (error) { setError(error.response?.data?.message || t('Peran belum dapat dihapus.', 'Could not remove role.')); } finally { setBusy(false); } }}>{t('Ya, hapus peran', 'Yes, remove role')}</button></div>}
  </form>;
}

function RoleProgress({ role, target, admin, ownRole, editable, onSaved }) {
  const { t } = useLanguage(); const saved = Number(role.progress) || 0;
  const [value, setValue] = useState(saved); const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  const dirty = value !== saved;
  const resubmitting = target.status === 'revision' && value === 100;
  async function save() { setBusy(true); setError(''); try { const { data } = role.id ? await api.patch(`/targets/${target.id}/roles/${role.id}/progress`, { progress: value }) : await api.patch(`/targets/${target.id}/progress`, { progress: value, note: target.note || '' }); await onSaved(data); } catch (error) { setError(error.response?.data?.message || t('Progres belum tersimpan. Coba lagi.', 'Could not save progress. Try again.')); } finally { setBusy(false); } }
  return <aside className="panel task-progress-card"><div className="task-card-title"><h2>{t('Progres subtugas', 'Subtask progress')}</h2><Icon name="chart" size={18}/></div><div className="task-progress-value">{value}<span>%</span></div><ProgressBar value={value}/>
    {editable ? <><label className="task-slider-label" htmlFor="role-progress">{t('Seberapa jauh pekerjaan Anda?', 'How far along is your work?')}</label><input id="role-progress" className="range-input" type="range" min="0" max="100" step="5" value={value} disabled={busy} onChange={event => setValue(Number(event.target.value))}/><div className="task-progress-presets" aria-label={t('Pilih persentase progres', 'Choose a progress percentage')}>{[0, 25, 50, 75, 100].map(percent => <button type="button" key={percent} aria-pressed={value === percent} disabled={busy} onClick={() => setValue(percent)}>{percent}%</button>)}</div><p className="task-progress-help">{dirty ? t(`Belum disimpan · Progres terakhir ${saved}%`, `Unsaved · Last saved progress ${saved}%`) : t('Progres ini menjadi bagian dari progres keseluruhan tugas.', 'This progress contributes to the overall task progress.')}</p>{resubmitting && <p className="task-field-help">{t('Selesaikan perbaikan sesuai catatan admin, lalu kirim ulang progres untuk ditinjau.', 'Complete the changes requested by the admin, then resubmit your progress for review.')}</p>}{value === 100 && dirty && !resubmitting && <p className="task-field-help">{t('Saat semua peran mencapai 100%, tugas akan dikirim ke admin untuk ditinjau.', 'When all roles reach 100%, the task is sent to the admin for review.')}</p>}<button type="button" className="btn-primary task-save-progress" disabled={(!dirty && !resubmitting) || busy} onClick={save}><Icon name="check" size={17}/>{busy ? t('Menyimpan…', 'Saving…') : resubmitting ? t('Kirim ulang progres', 'Resubmit progress') : t('Simpan progres', 'Save progress')}</button></> : <div className="task-readonly-note"><Icon name={saved === 100 ? 'check' : 'shield'} size={18}/><p>{admin ? t('Progres diperbarui oleh anggota penanggung jawab.', 'Progress is updated by the assigned member.') : !ownRole ? t('Anda hanya dapat melihat progres peran ini. Perubahan dilakukan oleh anggota penanggung jawab.', 'You can view this role’s progress. Only the assigned member can update it.') : t('Progres terkunci saat tugas menunggu tinjauan atau sudah selesai.', 'Progress is locked while the task awaits review or is completed.')}</p></div>}
    {error && <p role="alert" className="task-inline-error">{error}</p>}
  </aside>;
}

function TaskReview({ target, onSaved }) {
  const { t } = useLanguage(); const [quality, setQuality] = useState(Object.fromEntries(qualityKeys.map(key => [key, false])));
  const [feedback, setFeedback] = useState(''); const [notes, setNotes] = useState(''); const [busy, setBusy] = useState(''); const [error, setError] = useState('');
  const count = qualityKeys.filter(key => quality[key]).length;
  async function review(status) { setBusy(status); setError(''); try { const { data } = await api.patch(`/targets/${target.id}/review`, { status, feedback, ...quality, quality_review_notes: notes }); await onSaved(data); } catch (error) { setError(error.response?.data?.message || t('Tinjauan belum tersimpan. Coba lagi.', 'Could not save review. Try again.')); } finally { setBusy(''); } }
  return <details className="panel task-review"><summary><span className="task-review-symbol"><Icon name="shield" size={22}/></span><span><strong>{t('Tugas siap ditinjau', 'Task ready for review')}</strong><small>{t('Seluruh peran mencapai 100%. Tinjau hasil dan konfirmasi penyelesaiannya.', 'All roles reached 100%. Review the results and confirm completion.')}</small></span><span className="task-review-open">{t('Tinjau tugas', 'Review task')}<Icon name="chevron" size={17}/></span></summary><div className="task-review-content"><div className="task-review-checks"><h3>{t('Konfirmasi penyelesaian tugas', 'Confirm task completion')}<span>{count}/3</span></h3><p>{t('Pastikan ketiga hal berikut sudah terpenuhi.', 'Make sure all three requirements are met.')}</p>{qualityKeys.map((key, index) => <label key={key} className={quality[key] ? 'is-checked' : ''}><input type="checkbox" checked={quality[key]} disabled={!!busy} onChange={event => setQuality({ ...quality, [key]: event.target.checked })}/><span>{[t('Prosedur kerja telah diikuti', 'Work procedures were followed'), t('Bukti dan dokumen sudah memadai', 'Evidence and documents are sufficient'), t('Kertas kerja dan simpulan telah ditinjau', 'Workpapers and conclusions were reviewed')][index]}</span></label>)}</div><div className="task-review-notes"><label><span className="label">{t('Catatan untuk anggota', 'Notes for members')}</span><textarea className="input" rows="3" maxLength="4000" value={feedback} onChange={event => setFeedback(event.target.value)} placeholder={t('Tuliskan masukan atau hal yang perlu diperbaiki.', 'Add feedback or describe the changes needed.')}/><span className="task-field-help">{t('Wajib diisi jika tugas dikembalikan untuk revisi.', 'Required when returning the task for revision.')}</span></label><label><span className="label">{t('Catatan mutu (opsional)', 'Quality notes (optional)')}</span><textarea className="input" rows="2" maxLength="4000" value={notes} onChange={event => setNotes(event.target.value)}/></label></div></div>{error && <div className="alert alert-error" role="alert">{error}</div>}<div className="task-review-footer"><span>{count < 3 ? t('Lengkapi checklist untuk mengonfirmasi tugas selesai.', 'Complete the checklist to confirm task completion.') : t('Checklist lengkap. Tugas dapat dikonfirmasi selesai.', 'Checklist complete. You can confirm task completion.')}</span><button className="btn-secondary" disabled={!!busy || !feedback.trim()} onClick={() => review('revision')}>{busy === 'revision' ? t('Menyimpan…', 'Saving…') : t('Minta revisi', 'Request revision')}</button><button className="btn-primary" disabled={!!busy || count < 3} onClick={() => review('completed')}><Icon name="check" size={17}/>{busy === 'completed' ? t('Menyimpan…', 'Saving…') : t('Konfirmasi selesai', 'Confirm completion')}</button></div></details>;
}

function TaskAuditDetails({ target, role, editable, onSaved }) {
  const { t, formatDate } = useLanguage();
  const [draft, setDraft] = useState({}); const [dirty, setDirty] = useState(false); const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  useEffect(() => { if (!dirty) setDraft(Object.fromEntries(auditKeys.map(key => [key, target[key] ?? (key.endsWith('_progress') ? 0 : key === 'audit_status' ? 'Belum Mulai' : '')]))); }, [target, dirty]);
  function changeDraft(key, value) { setDirty(true); setDraft(current => ({ ...current, [key]: value })); }
  const stages = [[t('Pengumpulan data', 'Data collection'), 'data_progress'], [t('Analisis data', 'Data analysis'), 'analysis_progress'], [t('Kertas kerja', 'Workpapers'), 'workpaper_progress']];
  async function save(event) { event.preventDefault(); setBusy(true); setError(''); try { const { data } = await api.patch(`/targets/${target.id}/progress`, { ...draft, role_id: role.id, progress: Number(target.progress) }); await onSaved(data); setDirty(false); } catch (error) { setError(error.response?.data?.message || t('Rincian tugas belum tersimpan.', 'Could not save task details.')); } finally { setBusy(false); } }
  return <details className="panel task-context"><summary><Icon name="grid" size={18}/><span><strong>{t('Informasi & progres keseluruhan tugas', 'Task information & overall progress')}</strong><small>{t('Arahan umum, jadwal, dan rincian tahap audit', 'General instructions, schedule, and audit stages')}</small></span><Icon name="chevron" size={17}/></summary><div className="task-context-body"><p className="task-field-help">{t('Informasi di bagian ini berlaku untuk semua peran dalam tugas.', 'This information applies to all roles within the task.')}</p><p className="task-long-text">{target.description || t('Belum ada arahan tambahan.', 'No additional instructions yet.')}</p><dl className="task-meta-grid"><div><dt>{t('Tanggal mulai', 'Start date')}</dt><dd>{formatDate(target.start_date)}</dd></div><div><dt>{t('Tenggat', 'Due date')}</dt><dd>{formatDate(target.due_date)}</dd></div><div><dt>{t('Prioritas', 'Priority')}</dt><dd><Priority value={target.priority}/></dd></div><div><dt>{t('Status audit', 'Audit status')}</dt><dd>{target.audit_status}</dd></div></dl><div className="task-audit-stages"><div><span>{t('Progres keseluruhan', 'Overall progress')}</span><ProgressBar value={target.progress}/></div>{stages.map(([label, key]) => <div key={key}><span>{label}</span><ProgressBar value={target[key] || 0}/></div>)}</div>{target.note && <p className="task-long-text"><strong>{t('Catatan progres', 'Progress notes')}</strong><br/>{target.note}</p>}{[[t('Kendala', 'Blocker'), target.blocker], [t('Dampak kendala', 'Blocker impact'), target.blocker_impact], [t('Tindak lanjut', 'Follow-up'), target.follow_up], [t('Bukti yang dibutuhkan', 'Evidence needed'), target.evidence_needed], [t('Umpan balik admin', 'Admin feedback'), target.feedback], [t('Catatan review mutu', 'Quality review notes'), target.quality_review_notes]].filter(([, value]) => value).map(([label, value]) => <p key={label} className="task-long-text"><strong>{label}</strong><br/>{value}</p>)}
      {editable && <details className="task-audit-editor"><summary>{t('Perbarui rincian audit tugas', 'Update task audit details')}<Icon name="chevron" size={16}/></summary><form onSubmit={save}>{error && <div className="alert alert-error" role="alert">{error}</div>}<div className="task-form-columns">{stages.map(([label, key]) => <label key={key}><span className="label">{label} · {draft[key]}%</span><input className="range-input" type="range" min="0" max="100" step="5" value={draft[key] || 0} onChange={event => changeDraft(key, Number(event.target.value))}/></label>)}</div><label><span className="label">{t('Status audit', 'Audit status')}</span><select className="input" value={draft.audit_status} onChange={event => changeDraft('audit_status', event.target.value)}>{['Belum Mulai', 'Berjalan', 'Menunggu Data', 'Terhambat', 'Menunggu Review'].map(status => <option key={status}>{status}</option>)}</select></label>{[[t('Kendala utama', 'Main blocker'), 'blocker'], [t('Dampak kendala', 'Blocker impact'), 'blocker_impact'], [t('Rencana tindak lanjut', 'Follow-up plan'), 'follow_up'], [t('Bukti / data yang dibutuhkan', 'Evidence / data needed'), 'evidence_needed'], [t('Catatan progres', 'Progress notes'), 'note']].map(([label, key]) => <label key={key}><span className="label">{label}{key === 'blocker' && draft.audit_status === 'Terhambat' ? ' *' : ''}</span><textarea className="input" rows="2" maxLength={key === 'note' ? 4000 : 3000} required={key === 'blocker' && draft.audit_status === 'Terhambat'} value={draft[key] || ''} onChange={event => changeDraft(key, event.target.value)}/></label>)}<div className="task-form-actions"><button className="btn-primary" disabled={busy}>{busy ? t('Menyimpan…', 'Saving…') : t('Simpan rincian tugas', 'Save task details')}</button></div></form></details>}
    </div></details>;
}
