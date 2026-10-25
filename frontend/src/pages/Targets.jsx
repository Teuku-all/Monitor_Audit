import { useCallback, useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import Icon from '../components/Icon';
import TargetTable from '../components/TargetTable';
import { ErrorState, LoadingState } from '../components/States';

const blank = { title: '', description: '', assigned_to: '', due_date: '', priority: 'medium' };
export default function Targets() {
  const { user } = useAuth(); const { t } = useLanguage(); const admin = user?.role === 'admin';
  const location = useLocation(); const navigate = useNavigate();
  const now = new Date(); const minDueDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const [targets, setTargets] = useState([]); const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true); const [failed, setFailed] = useState(false); const [attempt, setAttempt] = useState(0);
  const [query, setQuery] = useState(''); const [filter, setFilter] = useState('all');
  const [modal, setModal] = useState(new URLSearchParams(location.search).has('create'));
  const [form, setForm] = useState(() => ({ ...blank, assigned_to: new URLSearchParams(location.search).get('member') || '' })); const [saving, setSaving] = useState(false); const [error, setError] = useState('');
  const load = useCallback(async (signal) => {
    setLoading(true); setFailed(false);
    try {
      const [list, memberList] = await Promise.all([api.get('/targets', { signal }), admin ? api.get('/users', { signal }) : Promise.resolve({ data: [] })]);
      setTargets(list.data); setMembers(memberList.data);
    } catch (e) { if (!signal?.aborted) setFailed(true); }
    finally { if (!signal?.aborted) setLoading(false); }
  }, [admin, attempt]);
  useEffect(() => { const c = new AbortController(); load(c.signal); return () => c.abort(); }, [load]);
  useEffect(() => { const params = new URLSearchParams(location.search); setModal(params.has('create')); if (params.has('create')) setForm(current => ({ ...current, assigned_to: params.get('member') || current.assigned_to })); }, [location.search]);
  const visible = targets.filter(x => (filter === 'all' || x.status === filter) && `${x.title} ${x.assigned_name || ''}`.toLowerCase().includes(query.toLowerCase()));
  function closeModal() { setModal(false); setError(''); setForm(blank); navigate('/admin/targets', { replace: true }); }
  async function create(event) {
    event.preventDefault(); setSaving(true); setError('');
    try { await api.post('/targets', { ...form, assigned_to: Number(form.assigned_to) }); closeModal(); setAttempt(x => x + 1); }
    catch (e) { setError(e.response?.data?.message || t('Target belum dapat dibuat. Periksa koneksi Anda.', 'Could not create target. Check your connection.')); }
    finally { setSaving(false); }
  }
  const statuses = ['all','assigned','in_progress','submitted','revision','completed'];
  return <div className="workspace-page">
    <div className="page-heading"><div><span className="eyebrow">{t('Ruang kerja tim','Team workspace')}</span><h1>{t('Target kerja','Work targets')}</h1><p>{admin ? t('Atur prioritas dan pantau progres pekerjaan tim.','Assign priorities and follow your team’s progress.') : t('Lihat arahan admin dan perbarui progres pekerjaan Anda.','Review your assignments and update your progress.')}</p></div>{admin && <button className="btn-primary" onClick={() => { setModal(true); navigate('/admin/targets?create=1'); }}><Icon name="plus" size={16}/>{t('Buat target','Create target')}</button>}{!admin && <Link className="btn-secondary" to="/member/upload"><Icon name="upload" size={15}/>{t('Kirim dokumen','Upload document')}</Link>}</div>
    <section className="panel"><div className="panel-header"><div><h2>{t('Semua penugasan','All assignments')}</h2><p>{t(`${visible.length} target ditampilkan`, `${visible.length} targets shown`)}</p></div></div><div className="table-toolbar"><label className="search-box"><Icon name="search" size={16}/><input aria-label={t('Cari target','Search targets')} placeholder={t('Cari target...','Search targets...')} value={query} onChange={e => setQuery(e.target.value)}/></label><select className="filter-select" value={filter} onChange={e => setFilter(e.target.value)} aria-label={t('Filter status','Filter by status')}>{statuses.map(s => <option key={s} value={s}>{s === 'all' ? t('Semua status','All statuses') : t(s === 'assigned' ? 'Ditugaskan' : s === 'in_progress' ? 'Sedang dikerjakan' : s === 'submitted' ? 'Menunggu tinjauan' : s === 'revision' ? 'Perlu revisi' : 'Selesai', s.replace('_',' '))}</option>)}</select></div>{loading ? <LoadingState/> : failed ? <div className="p-5"><ErrorState onRetry={() => setAttempt(x => x + 1)}/></div> : <TargetTable targets={visible}/>}</section>
    {admin && modal && <div className="modal-layer" role="presentation" onMouseDown={e => { if (e.target === e.currentTarget) closeModal(); }}><section className="modal" role="dialog" aria-modal="true" aria-labelledby="target-modal-title"><div className="modal-heading"><div><h2 id="target-modal-title">{t('Buat target kerja','Create a work target')}</h2><p>{t('Tulis arahan yang jelas dan pilih anggota yang bertanggung jawab.','Add clear instructions and choose an owner.')}</p></div><button className="icon-button" type="button" aria-label={t('Tutup','Close')} onClick={closeModal}>×</button></div>
      {error && <div role="alert" className="alert alert-error">{error}</div>}{members.length === 0 && !loading ? <div className="alert">{t('Belum ada anggota. Minta mereka membuat akun terlebih dahulu.','No members yet. Ask them to register first.')}</div> : <form className="target-form" onSubmit={create}>
        <div><label className="label" htmlFor="target-title">{t('Nama target','Target name')} *</label><input id="target-title" className="input" maxLength="200" required value={form.title} onChange={e => setForm({...form,title:e.target.value})} placeholder={t('Contoh: Audit kepatuhan kuartal 3','Example: Q3 compliance audit')}/></div>
        <div><label className="label" htmlFor="target-description">{t('Arahan pekerjaan','Work instructions')}</label><textarea id="target-description" className="input" rows="4" maxLength="5000" value={form.description} onChange={e => setForm({...form,description:e.target.value})} placeholder={t('Jelaskan ruang lingkup dan hasil yang diharapkan...','Describe the scope and expected outcome...')}/></div>
        <div className="form-row"><div><label className="label" htmlFor="target-member">{t('Tugaskan ke','Assign to')} *</label><select id="target-member" className="input" required value={form.assigned_to} onChange={e => setForm({...form,assigned_to:e.target.value})}><option value="">{t('Pilih anggota','Select a member')}</option>{members.map(m=><option key={m.id} value={m.id}>{m.name} · {m.email}</option>)}</select></div><div><label className="label" htmlFor="target-due">{t('Tenggat','Due date')} *</label><input id="target-due" type="date" className="input" required min={minDueDate} value={form.due_date} onChange={e => setForm({...form,due_date:e.target.value})}/></div></div>
        <div><label className="label" htmlFor="target-priority">{t('Prioritas','Priority')}</label><select id="target-priority" className="input" value={form.priority} onChange={e => setForm({...form,priority:e.target.value})}><option value="low">{t('Rendah','Low')}</option><option value="medium">{t('Sedang','Medium')}</option><option value="high">{t('Tinggi','High')}</option></select></div>
        <div className="form-actions"><button type="button" className="btn-secondary" onClick={closeModal}>{t('Batal','Cancel')}</button><button type="submit" className="btn-primary" disabled={saving || !members.length}>{saving ? t('Menyimpan...','Saving...') : t('Tugaskan target','Assign target')}</button></div>
      </form>}</section></div>}
  </div>;
}
