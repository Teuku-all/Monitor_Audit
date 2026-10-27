import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../api/axios';
import Icon from '../../components/Icon';
import ScheduleBadge from '../../components/ScheduleBadge';
import { EmptyState, ErrorState, LoadingState } from '../../components/States';
import { useLanguage } from '../../context/LanguageContext';

function addWeekdays(start, count) {
  if (!start) return '';
  const date = new Date(`${start}T12:00:00`);
  let days = 0;
  while (days < count) {
    date.setDate(date.getDate() + 1);
    if (date.getDay() !== 0 && date.getDay() !== 6) days += 1;
  }
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

const today = () => {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

export default function AuditProgram() {
  const { t, formatDate } = useLanguage();
  const [programs, setPrograms] = useState([]);
  const [targets, setTargets] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [programForm, setProgramForm] = useState({ title: 'Audit Acceleration Program', period: 'Triwulan IV 2026', start_date: '2026-10-01', due_date: addWeekdays('2026-10-01', 45), standard_workdays: 45, baseline_on_time_rate: '', baseline_first_pass_rate: '' });
  const [auditTitle, setAuditTitle] = useState('');
  const [baselineDraft, setBaselineDraft] = useState({ baseline_on_time_rate: '', baseline_first_pass_rate: '' });
  const [assignTo, setAssignTo] = useState('');

  async function load() {
    setLoading(true); setFailed(false);
    try {
      const [programResponse, targetResponse] = await Promise.all([api.get('/engagements'), api.get('/targets')]);
      setPrograms(programResponse.data);
      setTargets(targetResponse.data);
      setSelectedId(current => current && programResponse.data.some(item => item.id === current) ? current : programResponse.data[0]?.id ?? null);
    } catch { setFailed(true); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  const selected = programs.find(item => item.id === selectedId);
  useEffect(() => {
    setBaselineDraft({ baseline_on_time_rate: selected?.baseline_on_time_rate ?? '', baseline_first_pass_rate: selected?.baseline_first_pass_rate ?? '' });
  }, [selectedId, selected?.baseline_on_time_rate, selected?.baseline_first_pass_rate]);

  const programTargets = useMemo(() => targets.filter(item => item.program_id === selectedId), [targets, selectedId]);
  const staleTargets = programTargets.filter(item => item.status !== 'completed' && Date.now() - new Date(item.updated_at).getTime() > 7 * 86400000);
  const dueTargets = programTargets.filter(item => item.status !== 'completed' && ['yellow', 'red'].includes(item.schedule_status));
  const unassignedTargets = targets.filter(item => !item.engagement_id);
  const calculatedDue = addWeekdays(programForm.start_date, Number(programForm.standard_workdays) || 45);

  async function createProgram(event) {
    event.preventDefault(); setSaving(true); setError('');
    try {
      const { data } = await api.post('/engagements', { ...programForm, standard_workdays: Number(programForm.standard_workdays) });
      setPrograms(items => [data, ...items]); setSelectedId(data.id); setCreateOpen(false);
    } catch (e) { setError(e.response?.data?.message || t('Program audit belum dapat dibuat.', 'Could not create the audit program.')); }
    finally { setSaving(false); }
  }

  async function addAuditTitle(event) {
    event.preventDefault(); if (!selected) return; setSaving(true); setError('');
    try {
      await api.post(`/engagements/${selected.id}/engagements`, { title: auditTitle });
      setAuditTitle(''); await load();
    } catch (e) { setError(e.response?.data?.message || t('Judul audit belum dapat ditambahkan.', 'Could not add the audit title.')); }
    finally { setSaving(false); }
  }

  async function saveBaseline(event) {
    event.preventDefault(); if (!selected) return; setSaving(true); setError('');
    try {
      const { data } = await api.patch(`/engagements/${selected.id}`, baselineDraft);
      setPrograms(items => items.map(item => item.id === data.id ? data : item));
    } catch (e) { setError(e.response?.data?.message || t('Baseline belum tersimpan.', 'Could not save the baseline.')); }
    finally { setSaving(false); }
  }

  async function assignExistingTarget(targetId) {
    if (!assignTo) return;
    setSaving(true); setError('');
    try { await api.patch(`/targets/${targetId}/engagement`, { engagement_id: Number(assignTo) }); await load(); }
    catch(e) { setError(e.response?.data?.message || t('Sasaran belum dapat dikelompokkan.', 'Could not group the objective.')); }
    finally { setSaving(false); }
  }

  if (loading) return <LoadingState/>;
  if (failed) return <div className="workspace-page"><ErrorState onRetry={load}/></div>;

  return <div className="workspace-page audit-program-page">
    <div className="page-heading"><div><span className="eyebrow">{t('Audit Acceleration Program','Audit Acceleration Program')}</span><h1>{t('Program dan judul audit','Program and audit titles')}</h1><p>{t('Kelola periode uji coba, kelompokkan sasaran kerja, dan pantau KPI serta risiko mingguan.','Set the pilot period, group work objectives, and follow KPIs and weekly risks.')}</p></div><button className="btn-primary" onClick={() => setCreateOpen(value => !value)}><Icon name="plus" size={16}/>{t('Buat program','Create program')}</button></div>
    {error && <div role="alert" className="alert alert-error">{error}</div>}
    {createOpen && <section className="panel detail-content section-space"><h2>{t('Detail program','Program details')}</h2><form className="program-form" onSubmit={createProgram}>
      <div className="form-row"><div><label className="label" htmlFor="program-title">{t('Nama program','Program name')} *</label><input id="program-title" className="input" required maxLength="200" value={programForm.title} onChange={e=>setProgramForm({...programForm,title:e.target.value})}/></div><div><label className="label" htmlFor="program-period">{t('Periode','Period')}</label><input id="program-period" className="input" maxLength="100" value={programForm.period} onChange={e=>setProgramForm({...programForm,period:e.target.value})}/></div></div>
      <div className="form-row"><div><label className="label" htmlFor="program-start">{t('Tanggal mulai','Start date')} *</label><input id="program-start" className="input" type="date" required value={programForm.start_date} onChange={e=>setProgramForm({...programForm,start_date:e.target.value,due_date:addWeekdays(e.target.value,Number(programForm.standard_workdays)||45)})}/></div><div><label className="label" htmlFor="program-days">{t('Standar hari kerja','Standard working days')}</label><input id="program-days" className="input" type="number" min="1" max="260" value={programForm.standard_workdays} onChange={e=>{const days=Number(e.target.value);setProgramForm({...programForm,standard_workdays:days,due_date:addWeekdays(programForm.start_date,days||45)})}}/><small className="field-hint">{t(`Target selesai otomatis: ${calculatedDue} (Senin–Jumat; hari libur nasional tidak dihitung).`, `Default due date: ${calculatedDue} (weekdays only; public holidays are not excluded).`)}</small></div><div><label className="label" htmlFor="program-due">{t('Tenggat program','Program due date')} *</label><input id="program-due" className="input" type="date" required min={programForm.start_date} value={programForm.due_date} onChange={e=>setProgramForm({...programForm,due_date:e.target.value})}/><small className="field-hint">{t('Sesuaikan untuk hari libur atau kalender kerja internal.','Adjust for public holidays or your internal work calendar.')}</small></div></div>
      <p className="field-hint">{t('Baseline opsional. Masukkan hasil historis yang dapat ditelusuri; kosongkan jika belum tersedia.','Baselines are optional. Enter traceable historical results and leave blank when unavailable.')}</p>
      <div className="form-row"><div><label className="label" htmlFor="baseline-ontime">{t('Baseline audit tepat waktu (%)','On-time audit baseline (%)')}</label><input id="baseline-ontime" className="input" type="number" min="0" max="100" step="0.1" value={programForm.baseline_on_time_rate} onChange={e=>setProgramForm({...programForm,baseline_on_time_rate:e.target.value})}/></div><div><label className="label" htmlFor="baseline-quality">{t('Baseline lolos review pertama (%)','First-pass review baseline (%)')}</label><input id="baseline-quality" className="input" type="number" min="0" max="100" step="0.1" value={programForm.baseline_first_pass_rate} onChange={e=>setProgramForm({...programForm,baseline_first_pass_rate:e.target.value})}/></div></div>
      <button className="btn-primary" disabled={saving}>{saving?t('Menyimpan…','Saving…'):t('Simpan program','Save program')}</button>
    </form></section>}
    {!programs.length ? <section className="panel"><EmptyState icon="target" title={t('Belum ada program audit','No audit programs yet')} description={t('Buat program untuk mulai mengelompokkan judul audit dan sasaran kerja.','Create a program to group audit titles and work objectives.')}/></section> : <>
      <div className="program-tabs" role="tablist" aria-label={t('Daftar program audit','Audit program list')}>{programs.map(item=><button key={item.id} role="tab" aria-selected={selectedId===item.id} className={selectedId===item.id?'is-selected':''} onClick={()=>setSelectedId(item.id)}><strong>{item.title}</strong><small>{item.period || formatDate(item.start_date)}</small></button>)}</div>
      {selected && <>
        <section className="program-kpis">
          <article className="panel program-kpi"><small>{t('Audit selesai','Audits completed')}</small><strong>{selected.completed_engagements}/{selected.total_engagements}</strong></article>
          <article className="panel program-kpi"><small>{t('Tepat waktu · target ≥95%','On time · target ≥95%')}</small><strong>{selected.on_time_rate == null ? '—' : `${selected.on_time_rate}%`}</strong><span>{selected.baseline_on_time_rate == null ? t('Baseline belum diisi','Baseline not set') : t(`Baseline ${selected.baseline_on_time_rate}% · ${selected.on_time_rate >= selected.baseline_on_time_rate ? 'tidak turun' : 'di bawah baseline'}`, `Baseline ${selected.baseline_on_time_rate}% · ${selected.on_time_rate >= selected.baseline_on_time_rate ? 'maintained' : 'below baseline'}`)}{selected.on_time_rate != null && <b className={selected.on_time_rate >= 95 ? 'kpi-pass' : 'kpi-watch'}>{selected.on_time_rate >= 95 ? t('Target tercapai','Target met') : t('Di bawah target','Below target')}</b>}</span></article>
          <article className="panel program-kpi"><small>{t('Lolos review pertama · proxy mutu','First-pass review · quality proxy')}</small><strong>{selected.first_pass_rate == null ? '—' : `${selected.first_pass_rate}%`}</strong><span>{selected.baseline_first_pass_rate == null ? t('Baseline belum diisi','Baseline not set') : t(`Baseline ${selected.baseline_first_pass_rate}% · ${selected.first_pass_rate >= selected.baseline_first_pass_rate ? 'tidak turun' : 'di bawah baseline'}`, `Baseline ${selected.baseline_first_pass_rate}% · ${selected.first_pass_rate >= selected.baseline_first_pass_rate ? 'maintained' : 'below baseline'}`)}<small>{t('Proxy: sasaran selesai tanpa putaran revisi.','Proxy: objectives completed without a revision round.')}</small></span></article>
          <article className="panel program-kpi"><small>{t('Perlu perhatian minggu ini','Needs attention this week')}</small><strong>{staleTargets.length + dueTargets.length + selected.overdue_data_requests}</strong><span>{t(`${staleTargets.length} target belum diperbarui >7 hari · Data terverifikasi ${selected.verified_data_requests}/${selected.total_data_requests} · ${selected.open_data_requests} permintaan terbuka (${selected.overdue_data_requests} lewat tenggat)`, `${staleTargets.length} targets stale >7 days · Verified data ${selected.verified_data_requests}/${selected.total_data_requests} · ${selected.open_data_requests} open requests (${selected.overdue_data_requests} overdue)`)}</span></article>
        </section>
        <p className="program-method-note">{t('Tepat waktu dihitung per judul audit setelah selesai atau melewati tenggat. Indikator mutu adalah proxy review pertama pada sasaran kerja, bukan penilaian mutu substantif audit. Isi baseline dengan data historis yang sudah diverifikasi.','On-time rate counts each audit title once completed or after its due date. The quality indicator is a first-review proxy at work-objective level, not a substantive audit quality assessment. Use verified historical data for baselines.')}</p>
        <section className="panel detail-content section-space">
          <div className="panel-header"><div><h2>{selected.title}</h2><p>{selected.period} · {formatDate(selected.start_date)} — {formatDate(selected.due_date)} · {selected.standard_workdays} {t('hari kerja','working days')}</p></div><ScheduleBadge status={selected.schedule_status}/></div>
          <form className="baseline-form" onSubmit={saveBaseline}><div><label className="label" htmlFor="edit-baseline-ontime">{t('Baseline tepat waktu (%)','On-time baseline (%)')}</label><input id="edit-baseline-ontime" className="input" type="number" min="0" max="100" step="0.1" value={baselineDraft.baseline_on_time_rate} onChange={e=>setBaselineDraft({...baselineDraft,baseline_on_time_rate:e.target.value})}/></div><div><label className="label" htmlFor="edit-baseline-quality">{t('Baseline lolos review pertama (%)','First-pass review baseline (%)')}</label><input id="edit-baseline-quality" className="input" type="number" min="0" max="100" step="0.1" value={baselineDraft.baseline_first_pass_rate} onChange={e=>setBaselineDraft({...baselineDraft,baseline_first_pass_rate:e.target.value})}/></div><button className="btn-secondary" disabled={saving}>{t('Simpan baseline','Save baselines')}</button></form>
        </section>
        <section className="panel section-space"><div className="panel-header"><div><h2>{t('Judul audit uji coba','Pilot audit titles')}</h2><p>{t('Buat satu judul untuk tiap penugasan audit; tambahkan sasaran dan PIC di dalamnya.','Create one title per audit assignment, then add objectives and owners under it.')}</p></div></div>
          <form className="inline-create-form" onSubmit={addAuditTitle}><label className="sr-only" htmlFor="audit-title">{t('Judul audit','Audit title')}</label><input id="audit-title" className="input" required maxLength="200" placeholder={t('Nama judul audit','Audit title')} value={auditTitle} onChange={e=>setAuditTitle(e.target.value)}/><button className="btn-primary" disabled={saving}><Icon name="plus" size={15}/>{t('Tambah judul','Add title')}</button></form>
          {!selected.engagements.length ? <EmptyState icon="target" title={t('Belum ada judul audit','No audit titles yet')} description={t('Tambahkan judul audit untuk mengelompokkan sasaran kerja dan PIC.','Add audit titles to group objectives and owners.')}/> : <div className="table-scroll"><table className="data-table"><thead><tr><th>{t('Judul audit','Audit title')}</th><th>{t('Sasaran selesai','Objectives complete')}</th><th>{t('Update mingguan','Weekly updates')}</th><th>{t('Risiko tenggat','Schedule risk')}</th><th>{t('Tindakan','Actions')}</th></tr></thead><tbody>{selected.engagements.map(item=><tr key={item.id}><td><strong>{item.title}</strong><small>{formatDate(item.start_date)} – {formatDate(item.due_date)}</small></td><td>{item.completed_objectives}/{item.total_objectives}</td><td>{item.stale_objectives ? <span className="schedule-badge schedule-yellow">{item.stale_objectives} {t('perlu update','need update')}</span> : t('Terkini','Current')}</td><td><ScheduleBadge status={item.schedule_status}/></td><td><Link className="text-link" to={`/admin/targets?create=1&engagement=${item.id}`}>{t('Tambah sasaran / PIC','Add objective / owner')} <Icon name="arrow" size={14}/></Link></td></tr>)}</tbody></table></div>}
        </section>
        {unassignedTargets.length > 0 && <section className="panel section-space"><div className="panel-header"><div><h2>{t('Kelompokkan target yang sudah ada','Group existing targets')}</h2><p>{t('Sasaran lama dapat dipindahkan ke judul audit tanpa dibuat ulang.','Existing objectives can be linked to an audit title without recreating them.')}</p></div></div><div className="table-scroll"><table className="data-table"><thead><tr><th>{t('Sasaran','Objective')}</th><th>{t('PIC','Owner')}</th><th>{t('Tenggat','Due date')}</th><th>{t('Judul audit','Audit title')}</th><th>{t('Tindakan','Action')}</th></tr></thead><tbody>{unassignedTargets.map(item=><tr key={item.id}><td><Link className="table-title" to={`/admin/targets/${item.id}`}>{item.title}</Link></td><td>{item.assigned_name}</td><td>{formatDate(item.due_date)}</td><td><select className="input" aria-label={`${t('Pilih judul audit untuk','Choose audit title for')} ${item.title}`} value={assignTo} onChange={e=>setAssignTo(e.target.value)}><option value="">{t('Pilih judul','Select title')}</option>{selected.engagements.map(title=><option key={title.id} value={title.id}>{title.title}</option>)}</select></td><td><button className="btn-secondary" disabled={saving||!assignTo} onClick={()=>assignExistingTarget(item.id)}>{t('Kelompokkan','Group')}</button></td></tr>)}</tbody></table></div></section>}
        <section className="panel"><div className="panel-header"><div><h2>{t('Update mingguan dan tenggat','Weekly updates and deadlines')}</h2><p>{t('Satu update progres dicatat dalam riwayat setiap kali PIC menyimpan perubahan.','Each saved progress update is recorded in the objective history.')}</p></div></div>
          {[...staleTargets.map(item=>({...item,attention:'stale'})),...dueTargets.map(item=>({...item,attention:'due'}))].filter((item,index,array)=>array.findIndex(other=>other.id===item.id)===index).length ? <div className="attention-list">{[...staleTargets.map(item=>({...item,attention:'stale'})),...dueTargets.map(item=>({...item,attention:'due'}))].filter((item,index,array)=>array.findIndex(other=>other.id===item.id)===index).map(item=><Link key={item.id} to={`/admin/targets/${item.id}`} className="attention-item"><span><strong>{item.title}</strong><small>{item.assigned_name} · {item.attention==='stale'?t('Belum diperbarui lebih dari 7 hari','No update for more than 7 days'):t('Tenggat','Due')} {formatDate(item.due_date)}</small></span><ScheduleBadge status={item.schedule_status}/></Link>)}</div> : <EmptyState compact icon="check" title={t('Tidak ada update atau tenggat yang tertinggal','No stale updates or at-risk deadlines')} description={t('Target belum jatuh tempo dan progres diperbarui dalam 7 hari terakhir.','Objectives are not overdue and have been updated within the last 7 days.')}/>}</section>
      </>}
    </>}
  </div>;
}
