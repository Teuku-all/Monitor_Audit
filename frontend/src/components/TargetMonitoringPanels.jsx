import { useMemo, useState } from 'react';
import api from '../api/axios';
import { useLanguage } from '../context/LanguageContext';
import ScheduleBadge from './ScheduleBadge';

const today = () => {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

function requestRisk(item) {
  if (['verified', 'rejected'].includes(item.status)) return 'green';
  const remaining = Math.ceil((Date.parse(`${item.due_date}T00:00:00`) - Date.parse(`${today()}T00:00:00`)) / 86400000);
  return remaining < 0 ? 'red' : remaining <= 3 ? 'yellow' : 'green';
}

export function DataRequestPanel({ target, admin }) {
  const { t, formatDate } = useLanguage();
  const [items, setItems] = useState(target.data_requests || []);
  const [form, setForm] = useState({ requested_item: '', auditee_pic: '', requested_at: today(), due_date: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [drafts, setDrafts] = useState({});
  const verifiedCount = items.filter(item => item.status === 'verified').length;
  const completionRate = items.length ? Math.round(verifiedCount / items.length * 100) : 0;

  async function create(event) {
    event.preventDefault(); setBusy(true); setError(''); setNotice('');
    try {
      const { data } = await api.post(`/targets/${target.id}/data-requests`, form);
      setItems(current => [...current, data].sort((a,b) => a.due_date.localeCompare(b.due_date)));
      setForm({ requested_item: '', auditee_pic: '', requested_at: today(), due_date: '' });
      setNotice(t('Permintaan data tercatat.','Data request recorded.'));
    } catch (e) { setError(e.response?.data?.message || t('Permintaan belum tersimpan.','Could not save the request.')); }
    finally { setBusy(false); }
  }

  async function update(item, patch) {
    setBusy(true); setError(''); setNotice('');
    try {
      const { data } = await api.patch(`/targets/data-requests/${item.id}`, patch);
      setItems(current => current.map(row => row.id === item.id ? data : row));
      setNotice(t('Permintaan data diperbarui.','Data request updated.'));
    } catch (e) { setError(e.response?.data?.message || t('Perubahan belum tersimpan.','Could not save the change.')); }
    finally { setBusy(false); }
  }

  return <section className="panel detail-content monitoring-panel">
    <div className="panel-header"><div><h2>{t('Permintaan data auditee','Auditee data requests')}</h2><p>{t('Catat PIC auditee, tanggal permintaan, penerimaan, verifikasi, eskalasi, dan handover.','Track the auditee contact, request and receipt dates, verification, escalation, and handover.')}</p></div></div>
    {notice && <div className="alert alert-success" role="status">{notice}</div>}{error && <div className="alert alert-error" role="alert">{error}</div>}
    <form className="request-form" onSubmit={create}>
      <div><label className="label" htmlFor={`request-item-${target.id}`}>{t('Data / dokumen yang diminta','Requested data / document')} *</label><input id={`request-item-${target.id}`} className="input" required maxLength="1000" value={form.requested_item} onChange={e=>setForm({...form,requested_item:e.target.value})}/></div>
      <div className="form-row"><div><label className="label" htmlFor={`auditee-pic-${target.id}`}>{t('PIC auditee','Auditee contact')} *</label><input id={`auditee-pic-${target.id}`} className="input" required maxLength="200" value={form.auditee_pic} onChange={e=>setForm({...form,auditee_pic:e.target.value})}/></div><div><label className="label" htmlFor={`request-date-${target.id}`}>{t('Tanggal diminta','Request date')} *</label><input id={`request-date-${target.id}`} className="input" type="date" required value={form.requested_at} onChange={e=>setForm({...form,requested_at:e.target.value})}/></div><div><label className="label" htmlFor={`request-due-${target.id}`}>{t('Tenggat data','Data due date')} *</label><input id={`request-due-${target.id}`} className="input" type="date" required min={form.requested_at} value={form.due_date} onChange={e=>setForm({...form,due_date:e.target.value})}/></div></div>
      <button className="btn-secondary" disabled={busy}>{t('Catat permintaan','Record request')}</button>
    </form>
    {!items.length ? <p className="field-hint">{t('Belum ada permintaan data untuk sasaran ini.','No data requests are recorded for this objective yet.')}</p> : <><div className="request-completeness"><span>{t('Data diterima dan diverifikasi','Data received and verified')} <strong>{verifiedCount}/{items.length} · {completionRate}%</strong></span><div className="audit-track"><i style={{width:`${completionRate}%`}}/></div></div><div className="request-list">{items.map(item=>{
      const draft = drafts[item.id] || { follow_up: item.follow_up || '', handover_note: item.handover_note || '' };
      return <article className="request-card" key={item.id}>
        <div className="request-card-head"><div><strong>{item.requested_item}</strong><small>{t('PIC auditee','Auditee contact')}: {item.auditee_pic}</small></div><div className="request-state"><span className={`request-status request-${item.status}`}>{t(item.status==='requested'?'Diminta':item.status==='received'?'Diterima':item.status==='verified'?'Terverifikasi':'Perlu klarifikasi',item.status==='requested'?'Requested':item.status==='received'?'Received':item.status==='verified'?'Verified':'Needs clarification')}</span><ScheduleBadge status={requestRisk(item)}/></div></div>
        <div className="request-meta"><span>{t('Diminta','Requested')}: {formatDate(item.requested_at)}</span><span>{t('Tenggat','Due')}: {formatDate(item.due_date)}</span><span>{t('Diterima','Received')}: {item.received_at?formatDate(item.received_at):'—'}</span><span>{t('Diverifikasi','Verified')}: {item.verified_at?formatDate(item.verified_at):'—'}</span></div>
        <div className="request-actions"><label className="request-note"><span className="label">{t('Tindak lanjut / eskalasi','Follow-up / escalation')}</span><textarea className="input" rows="2" maxLength="3000" value={draft.follow_up} onChange={e=>setDrafts({...drafts,[item.id]:{...draft,follow_up:e.target.value}})}/></label><label className="request-note"><span className="label">{t('Catatan direct handover','Direct handover note')}</span><textarea className="input" rows="2" maxLength="1000" value={draft.handover_note} onChange={e=>setDrafts({...drafts,[item.id]:{...draft,handover_note:e.target.value}})}/></label></div>
        {(item.escalated_at||item.handover_at) && <p className="request-meta">{item.escalated_at&&<span>{t('Dieskalasikan','Escalated')}: {formatDate(item.escalated_at)}</span>}{item.handover_at&&<span>{t('Direct handover','Direct handover')}: {formatDate(item.handover_at)}</span>}</p>}
        <div className="request-buttons"><button type="button" className="btn-secondary" disabled={busy} onClick={()=>update(item,{follow_up:draft.follow_up,handover_note:draft.handover_note})}>{t('Simpan catatan','Save notes')}</button>{item.status==='requested'&&<button type="button" className="btn-secondary" disabled={busy} onClick={()=>update(item,{status:'received',received_at:today()})}>{t('Tandai diterima','Mark received')}</button>}{admin&&item.status==='received'&&<button type="button" className="btn-primary" disabled={busy} onClick={()=>update(item,{status:'verified'})}>{t('Verifikasi data','Verify data')}</button>}{!item.escalated_at&&item.status==='requested'&&<button type="button" className="text-link" disabled={busy} onClick={()=>update(item,{escalate:true,follow_up:draft.follow_up})}>{t('Eskalasi','Escalate')}</button>}{!item.handover_at&&<button type="button" className="text-link" disabled={busy} onClick={()=>update(item,{direct_handover:true,handover_note:draft.handover_note})}>{t('Catat jemput bola','Log direct handover')}</button>}</div>
      </article>;
    })}</div></>}
  </section>;
}

export function WorkLogPanel({ target, admin }) {
  const { t, formatDate } = useLanguage();
  const [items, setItems] = useState(target.work_logs || []);
  const [form, setForm] = useState({ work_date: today(), hours: '', note: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const total = useMemo(() => items.reduce((sum,item)=>sum+Number(item.hours||0),0),[items]);
  async function create(event) {
    event.preventDefault(); setBusy(true); setError('');
    try {
      const { data } = await api.post(`/targets/${target.id}/work-logs`, {...form,hours:Number(form.hours)});
      setItems(current=>[data,...current]); setForm({work_date:today(),hours:'',note:''});
    } catch(e) { setError(e.response?.data?.message||t('Jam kerja belum tersimpan.','Could not save work hours.')); }
    finally { setBusy(false); }
  }
  return <section className="panel detail-content monitoring-panel">
    <div className="panel-header"><div><h2>{t('Jam kerja audit','Audit work hours')}</h2><p>{t(`Total tercatat ${total.toFixed(1)} jam.`,`${total.toFixed(1)} hours recorded.`)}</p></div></div>
    {error&&<div className="alert alert-error" role="alert">{error}</div>}
    {!admin&&<form className="work-log-form" onSubmit={create}><div><label className="label" htmlFor={`work-date-${target.id}`}>{t('Tanggal','Date')}</label><input id={`work-date-${target.id}`} className="input" type="date" required value={form.work_date} onChange={e=>setForm({...form,work_date:e.target.value})}/></div><div><label className="label" htmlFor={`work-hours-${target.id}`}>{t('Jam','Hours')}</label><input id={`work-hours-${target.id}`} className="input" type="number" min="0.25" max="24" step="0.25" required value={form.hours} onChange={e=>setForm({...form,hours:e.target.value})}/></div><div><label className="label" htmlFor={`work-note-${target.id}`}>{t('Pekerjaan yang dilakukan','Work completed')}</label><input id={`work-note-${target.id}`} className="input" maxLength="2000" value={form.note} onChange={e=>setForm({...form,note:e.target.value})}/></div><button className="btn-secondary" disabled={busy}>{t('Tambah jam','Add hours')}</button></form>}
    {!items.length?<p className="field-hint">{t('Belum ada jam kerja tercatat.','No work hours recorded yet.')}</p>:<div className="work-log-list">{items.map(item=><div key={item.id}><span><strong>{formatDate(item.work_date)}</strong><small>{item.member_name||t('Anda','You')} · {item.note||t('Tidak ada catatan','No note')}</small></span><b>{Number(item.hours).toFixed(1)} h</b></div>)}</div>}
  </section>;
}

export function ProgressHistoryPanel({ items = [] }) {
  const { t, formatDate } = useLanguage();
  return <section className="panel detail-content monitoring-panel"><div className="panel-header"><div><h2>{t('Riwayat update mingguan','Weekly progress history')}</h2><p>{t('Setiap penyimpanan progres dicatat agar perubahan dapat ditelusuri.','Each saved progress update is recorded so changes can be reviewed.')}</p></div></div>{!items.length?<p className="field-hint">{t('Riwayat akan muncul setelah progres pertama disimpan.','History will appear after the first progress update.')}</p>:<div className="history-list">{items.map(item=><article key={item.id}><span className="history-date"><strong>{formatDate(item.created_at,{day:'numeric',month:'short'})}</strong><small>{formatDate(item.created_at,{hour:'2-digit',minute:'2-digit'})}</small></span><span><strong>{item.member_name}</strong><small>{item.audit_status} · {t('Progres','Progress')} {item.progress}% · {t('Data','Data')} {item.data_progress}% · {t('Analisa','Analysis')} {item.analysis_progress}% · {t('KKP','Workpaper')} {item.workpaper_progress}%</small>{item.note&&<p>{item.note}</p>}</span></article>)}</div>}</section>;
}
