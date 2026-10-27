import { useCallback, useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import Icon from '../components/Icon';
import TargetTable from '../components/TargetTable';
import { ErrorState, LoadingState } from '../components/States';

const blank = { title: '', description: '', evidence_needed: '', assigned_to: '', engagement_id: '', start_date: '', due_date: '', reviewer: '', priority: 'medium' };
const auditTemplates = [
  {title:'Pengadaan dan pemilihan vendor',description:'Tinjau proses pengadaan, evaluasi penawaran, pemilihan vendor, dan kepatuhan terhadap kontrak.',evidence_needed:'KAK/TOR, dokumen tender, penawaran, evaluasi, kontrak',priority:'high'},
  {title:'Kewajaran tarif angkutan',description:'Bandingkan tarif kontrak dengan invoice, rute, dan data pembanding yang relevan.',evidence_needed:'Kontrak tarif, invoice, rute, data pembanding',priority:'high'},
  {title:'Realisasi perjalanan / validasi ritase',description:'Validasi perjalanan dan ritase dengan bukti operasi yang independen.',evidence_needed:'Surat jalan, GPS, log gerbang, bukti penerimaan',priority:'critical'},
  {title:'Volume, berat, dan kehilangan pupuk',description:'Rekonsiliasi berat pengiriman, penerimaan, dan pencatatan stok untuk mengidentifikasi selisih.',evidence_needed:'Tiket timbang, surat jalan, bukti penerimaan, stok',priority:'high'},
  {title:'Invoice dan pembayaran',description:'Lakukan pencocokan tiga arah dan uji duplikasi invoice serta pembayaran.',evidence_needed:'Invoice, kontrak, bukti penerimaan, bukti transfer',priority:'critical'},
  {title:'Investigasi indikasi fraud / tindak lanjut',description:'Susun kronologi, konfirmasi bukti secara independen, dan dokumentasikan tindak lanjut.',evidence_needed:'Log perubahan data, konfirmasi independen, kronologi',priority:'high'},
];
export default function Targets() {
  const { user } = useAuth(); const { t } = useLanguage(); const admin = user?.role === 'admin';
  const location = useLocation(); const navigate = useNavigate();
  const now = new Date(); const minDueDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const [targets, setTargets] = useState([]); const [members, setMembers] = useState([]); const [programs, setPrograms] = useState([]);
  const [loading, setLoading] = useState(true); const [failed, setFailed] = useState(false); const [attempt, setAttempt] = useState(0);
  const [query, setQuery] = useState(''); const [filter, setFilter] = useState('all');
  const [modal, setModal] = useState(new URLSearchParams(location.search).has('create'));
  const [form, setForm] = useState(() => ({ ...blank, assigned_to: new URLSearchParams(location.search).get('member') || '' })); const [saving, setSaving] = useState(false); const [error, setError] = useState('');
  const load = useCallback(async (signal) => {
    setLoading(true); setFailed(false);
    try {
      const [list, memberList, programList] = await Promise.all([api.get('/targets', { signal }), admin ? api.get('/users', { signal }) : Promise.resolve({ data: [] }), admin ? api.get('/engagements', { signal }) : Promise.resolve({ data: [] })]);
      setTargets(list.data); setMembers(memberList.data); setPrograms(programList.data);
    } catch (e) { if (!signal?.aborted) setFailed(true); }
    finally { if (!signal?.aborted) setLoading(false); }
  }, [admin, attempt]);
  useEffect(() => { const c = new AbortController(); load(c.signal); return () => c.abort(); }, [load]);
  const engagements = programs.flatMap(program => program.engagements.map(item => ({ ...item, program_title: program.title })));
  useEffect(() => {
    const params = new URLSearchParams(location.search); setModal(params.has('create'));
    const engagementId = params.get('engagement') || '';
    const engagement = engagements.find(item => String(item.id) === engagementId);
    if (params.has('create')) setForm(current => ({
      ...current,
      assigned_to: params.get('member') || current.assigned_to,
      engagement_id: engagementId || current.engagement_id,
      start_date: engagement?.start_date ? String(engagement.start_date).slice(0, 10) : current.start_date,
      due_date: engagement?.due_date ? String(engagement.due_date).slice(0, 10) : current.due_date,
    }));
  }, [location.search, programs]);
  const visible = targets.filter(x => (filter === 'all' || x.status === filter) && `${x.title} ${x.assigned_name || ''}`.toLowerCase().includes(query.toLowerCase()));
  function closeModal() { setModal(false); setError(''); setForm(blank); navigate('/admin/targets', { replace: true }); }
  async function create(event) {
    event.preventDefault(); setSaving(true); setError('');
    try { await api.post('/targets', { ...form, assigned_to: Number(form.assigned_to), engagement_id: form.engagement_id ? Number(form.engagement_id) : null }); closeModal(); setAttempt(x => x + 1); }
    catch (e) { setError(e.response?.data?.message || t('Target belum dapat dibuat. Periksa koneksi Anda.', 'Could not create target. Check your connection.')); }
    finally { setSaving(false); }
  }
  const statuses = ['all','assigned','in_progress','submitted','revision','completed'];
  const selectedEngagement = engagements.find(item => String(item.id) === String(form.engagement_id));
  return <div className="workspace-page">
    <div className="page-heading"><div><span className="eyebrow">{t('Ruang kerja tim','Team workspace')}</span><h1>{t('Target kerja','Work targets')}</h1><p>{admin ? t('Atur prioritas dan pantau progres pekerjaan tim.','Assign priorities and follow your team’s progress.') : t('Lihat arahan admin dan perbarui progres pekerjaan Anda.','Review your assignments and update your progress.')}</p></div>{admin && <button className="btn-primary" onClick={() => { setModal(true); navigate('/admin/targets?create=1'); }}><Icon name="plus" size={16}/>{t('Buat target','Create target')}</button>}{!admin && <Link className="btn-secondary" to="/member/upload"><Icon name="upload" size={15}/>{t('Kirim dokumen','Upload document')}</Link>}</div>
    <section className="panel"><div className="panel-header"><div><h2>{t('Semua penugasan','All assignments')}</h2><p>{t(`${visible.length} target ditampilkan`, `${visible.length} targets shown`)}</p></div></div><div className="table-toolbar"><label className="search-box"><Icon name="search" size={16}/><input aria-label={t('Cari target','Search targets')} placeholder={t('Cari target...','Search targets...')} value={query} onChange={e => setQuery(e.target.value)}/></label><select className="filter-select" value={filter} onChange={e => setFilter(e.target.value)} aria-label={t('Filter status','Filter by status')}>{statuses.map(s => <option key={s} value={s}>{s === 'all' ? t('Semua status','All statuses') : t(s === 'assigned' ? 'Ditugaskan' : s === 'in_progress' ? 'Sedang dikerjakan' : s === 'submitted' ? 'Menunggu tinjauan' : s === 'revision' ? 'Perlu revisi' : 'Selesai', s.replace('_',' '))}</option>)}</select></div>{loading ? <LoadingState/> : failed ? <div className="p-5"><ErrorState onRetry={() => setAttempt(x => x + 1)}/></div> : <TargetTable targets={visible}/>}</section>
    {admin && modal && <div className="modal-layer" role="presentation" onMouseDown={e => { if (e.target === e.currentTarget) closeModal(); }}><section className="modal" role="dialog" aria-modal="true" aria-labelledby="target-modal-title"><div className="modal-heading"><div><h2 id="target-modal-title">{t('Buat target kerja','Create a work target')}</h2><p>{t('Tulis arahan yang jelas dan pilih anggota yang bertanggung jawab.','Add clear instructions and choose an owner.')}</p></div><button className="icon-button" type="button" aria-label={t('Tutup','Close')} onClick={closeModal}>×</button></div>
      {error && <div role="alert" className="alert alert-error">{error}</div>}{members.length === 0 && !loading ? <div className="alert">{t('Belum ada anggota. Minta mereka membuat akun terlebih dahulu.','No members yet. Ask them to register first.')}</div> : <form className="target-form" onSubmit={create}>
        <div><label className="label" htmlFor="target-engagement">{t('Judul audit / program','Audit title / program')}</label><select id="target-engagement" className="input" value={form.engagement_id} onChange={e=>{const item=engagements.find(value=>String(value.id)===e.target.value);setForm(current=>({...current,engagement_id:e.target.value,start_date:item?String(item.start_date).slice(0,10):current.start_date,due_date:item?String(item.due_date).slice(0,10):current.due_date}));}}><option value="">{t('Tidak dikelompokkan','No group')}</option>{engagements.map(item=><option key={item.id} value={item.id}>{item.program_title} · {item.title}</option>)}</select></div>
        <div><label className="label" htmlFor="audit-template">{t('Template sasaran audit angkutan pupuk','Fertilizer transport audit template')}</label><select id="audit-template" className="input" value="" onChange={e=>{const preset=auditTemplates[Number(e.target.value)];if(preset)setForm(current=>({...current,...preset}));}}><option value="">{t('Pilih sasaran untuk mengisi draft','Choose an objective to prefill the draft')}</option>{auditTemplates.map((item,index)=><option key={item.title} value={index}>{item.title}</option>)}</select></div>
        <div><label className="label" htmlFor="target-title">{t('Nama target','Target name')} *</label><input id="target-title" className="input" maxLength="200" required value={form.title} onChange={e => setForm({...form,title:e.target.value})} placeholder={t('Contoh: Audit kepatuhan kuartal 3','Example: Q3 compliance audit')}/></div>
        <div><label className="label" htmlFor="target-description">{t('Arahan pekerjaan','Work instructions')}</label><textarea id="target-description" className="input" rows="4" maxLength="5000" value={form.description} onChange={e => setForm({...form,description:e.target.value})} placeholder={t('Jelaskan ruang lingkup dan hasil yang diharapkan...','Describe the scope and expected outcome...')}/></div>
        <div><label className="label" htmlFor="target-evidence">{t('Bukti / data yang dibutuhkan','Evidence / data needed')}</label><textarea id="target-evidence" className="input" rows="2" maxLength="3000" value={form.evidence_needed} onChange={e=>setForm({...form,evidence_needed:e.target.value})}/></div>
        <div className="form-row"><div><label className="label" htmlFor="target-member">{t('Tugaskan ke','Assign to')} *</label><select id="target-member" className="input" required value={form.assigned_to} onChange={e => setForm({...form,assigned_to:e.target.value})}><option value="">{t('Pilih anggota','Select a member')}</option>{members.map(m=><option key={m.id} value={m.id}>{m.name} · {m.email}</option>)}</select></div><div><label className="label" htmlFor="target-reviewer">{t('Ketua tim / reviewer','Team lead / reviewer')}</label><input id="target-reviewer" className="input" maxLength="200" value={form.reviewer} onChange={e=>setForm({...form,reviewer:e.target.value})}/></div></div>
        <div className="form-row"><div><label className="label" htmlFor="target-start">{t('Tanggal mulai','Start date')}</label><input id="target-start" type="date" className="input" min={selectedEngagement?.start_date} max={selectedEngagement?.due_date} value={form.start_date} onChange={e => setForm({...form,start_date:e.target.value})}/></div><div><label className="label" htmlFor="target-due">{t('Target selesai','Target completion')} *</label><input id="target-due" type="date" className="input" required min={selectedEngagement?.start_date || (form.start_date && form.start_date > minDueDate ? form.start_date : minDueDate)} max={selectedEngagement?.due_date} value={form.due_date} onChange={e => setForm({...form,due_date:e.target.value})}/></div></div>
        <div><label className="label" htmlFor="target-priority">{t('Prioritas','Priority')}</label><select id="target-priority" className="input" value={form.priority} onChange={e => setForm({...form,priority:e.target.value})}><option value="low">{t('Rendah','Low')}</option><option value="medium">{t('Normal','Normal')}</option><option value="high">{t('Tinggi','High')}</option><option value="critical">{t('Kritis','Critical')}</option></select></div>
        <div className="form-actions"><button type="button" className="btn-secondary" onClick={closeModal}>{t('Batal','Cancel')}</button><button type="submit" className="btn-primary" disabled={saving || !members.length}>{saving ? t('Menyimpan...','Saving...') : t('Tugaskan target','Assign target')}</button></div>
      </form>}</section></div>}
  </div>;
}
