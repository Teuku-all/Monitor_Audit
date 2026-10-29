import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import Icon from '../components/Icon';
import TargetTable from '../components/TargetTable';
import { ErrorState, LoadingState } from '../components/States';

const blank = { title: '', audit_title: '', description: '', evidence_needed: '', assigned_to: '', engagement_id: '', start_date: '', due_date: '', priority: 'medium' };
const auditChoice = item => `${item.title} · ${item.program_title}`;
export default function Targets() {
  const { user } = useAuth(); const { t, formatDate } = useLanguage(); const admin = user?.role === 'admin';
  const location = useLocation(); const navigate = useNavigate();
  const now = new Date(); const minDueDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const [targets, setTargets] = useState([]); const [members, setMembers] = useState([]); const [programs, setPrograms] = useState([]);
  const [loading, setLoading] = useState(true); const [failed, setFailed] = useState(false); const [attempt, setAttempt] = useState(0);
  const [query, setQuery] = useState(''); const [filter, setFilter] = useState('all');
  const [step, setStep] = useState(0); const [createdTarget, setCreatedTarget] = useState(null); const [notice, setNotice] = useState('');
  const [modal, setModal] = useState(new URLSearchParams(location.search).has('create'));
  const dialogRef = useRef(null); const createButtonRef = useRef(null);
  const [form, setForm] = useState(() => ({ ...blank, assigned_to: new URLSearchParams(location.search).get('member') || '' })); const [saving, setSaving] = useState(false); const [error, setError] = useState('');
  const [additionalRoles, setAdditionalRoles] = useState([]); const [primaryRoleName, setPrimaryRoleName] = useState('Pelaksana'); const [primaryRoleDetails, setPrimaryRoleDetails] = useState({ work_target: '', required_documents: '' }); const [driveDocs, setDriveDocs] = useState([]);
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
      audit_title: engagement?.title || current.audit_title,
      start_date: engagement?.start_date ? String(engagement.start_date).slice(0, 10) : current.start_date,
      due_date: engagement?.due_date ? String(engagement.due_date).slice(0, 10) : current.due_date,
    }));
  }, [location.search, programs]);
  const visible = targets.filter(x => (filter === 'all' || x.status === filter) && `${x.title} ${x.engagement_title || x.audit_title || ''} ${x.assigned_team || x.assigned_name || ''}`.toLowerCase().includes(query.toLowerCase()));
  const closeModal = useCallback(() => { setModal(false); setError(''); setForm(blank); setAdditionalRoles([]); setPrimaryRoleName('Pelaksana'); setPrimaryRoleDetails({ work_target: '', required_documents: '' }); setDriveDocs([]); setStep(0); setCreatedTarget(null); setAttempt(value=>value+1); navigate('/admin/targets', { replace: true }); }, [navigate]);
  useEffect(() => {
    if (!admin || !modal) return undefined;
    const previousFocus = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const frame = window.requestAnimationFrame(() => {
      (dialogRef.current?.querySelector('#target-title') || dialogRef.current?.querySelector('button'))?.focus();
    });
    function onKeyDown(event) {
      if (event.key === 'Escape') { event.preventDefault(); if(dialogRef.current?.getAttribute('aria-busy')!=='true')closeModal(); return; }
      if (event.key !== 'Tab') return;
      const controls = Array.from(dialogRef.current?.querySelectorAll('button:not([disabled]), a[href], input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex="0"]') || []).filter(item => item.getClientRects().length);
      const first = controls[0]; const last = controls[controls.length - 1];
      if (!first) return;
      if (event.shiftKey && (document.activeElement === first || !dialogRef.current?.contains(document.activeElement))) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && (document.activeElement === last || !dialogRef.current?.contains(document.activeElement))) { event.preventDefault(); first.focus(); }
    }
    document.addEventListener('keydown', onKeyDown);
    return () => {
      window.cancelAnimationFrame(frame);
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', onKeyDown);
      const restore = previousFocus?.isConnected && previousFocus !== document.body ? previousFocus : createButtonRef.current;
      restore?.focus();
    };
  }, [admin, modal, closeModal]);
  useEffect(() => {
    if (!modal) return undefined;
    const frame = window.requestAnimationFrame(() => {
      dialogRef.current?.scrollTo({top:0,behavior:'instant'});
      dialogRef.current?.querySelector('.task-step-content input, .task-step-content button')?.focus({preventScroll:true});
    });
    return () => window.cancelAnimationFrame(frame);
  }, [step, modal]);
  function changeAuditTitle(value) {
    const normalized = value.trim().toLowerCase();
    const selected = engagements.find(item => String(item.id) === String(form.engagement_id));
    const item = engagements.find(item => auditChoice(item).toLowerCase() === normalized)
      || (selected?.title.trim().toLowerCase() === normalized ? selected : null);
    setForm(current => ({
      ...current, audit_title: item?.title || value, engagement_id: item ? String(item.id) : '',
      start_date: item ? String(item.start_date).slice(0, 10) : current.start_date,
      due_date: item ? String(item.due_date).slice(0, 10) : current.due_date,
    }));
  }
  async function create(event) {
    event.preventDefault(); setError('');
    const roles = [{ role_name: primaryRoleName.trim(), user_id: Number(form.assigned_to), ...primaryRoleDetails }, ...additionalRoles.map(row => ({ ...row, role_name: row.role_name.trim(), user_id: Number(row.user_id) }))];
    if (step >= 1) {
      const rolePairs = roles.map(role => JSON.stringify([role.role_name, role.user_id]));
      if (new Set(rolePairs).size !== rolePairs.length) {
        setError(t('Nama peran dan anggota yang sama tidak boleh ditambahkan dua kali. Ubah nama peran atau pilih anggota lain.', 'The same role name and member cannot be added twice. Change the role name or choose another member.'));
        return;
      }
    }
    if (step < 2) {
      if(step===0&&!form.title.trim()) {setError(t('Isi nama tugas terlebih dahulu.','Enter the task name first.'));return;}
      if(step===1&&(!primaryRoleName.trim()||additionalRoles.some(role=>!role.role_name.trim()))) {setError(t('Isi nama untuk setiap peran anggota.','Enter a name for each member role.'));return;}
      setStep(step + 1); return;
    }
    setSaving(true);
    try {
      const suppliedDocs = driveDocs.filter(row => row.title.trim() || row.drive_url.trim());
      if (suppliedDocs.some(row => !row.title.trim() || !/^https:\/\/drive\.google\.com\/(?:drive\/(?:u\/\d+\/)?|)folders\/[a-zA-Z0-9_-]+/i.test(row.drive_url.trim()))) throw new Error(t('Lengkapi nama dan tautan folder Google Drive untuk setiap folder.','Complete the name and Google Drive folder URL for each folder.'));
      let target = createdTarget;
      if (!target) {
        const response = await api.post('/targets', { ...form, title: form.title.trim(), audit_title: form.audit_title.trim(), assigned_to: Number(form.assigned_to), engagement_id: form.engagement_id ? Number(form.engagement_id) : null, role_assignments: roles });
        target = response.data; setCreatedTarget(target);
      }
      const failedDocs = [];
      for (const doc of suppliedDocs) {
        try { await api.post(`/targets/${target.id}/documents`, { title: doc.title.trim(), drive_url: doc.drive_url.trim() }); }
        catch { failedDocs.push(doc); }
      }
      if (failedDocs.length) {
        setDriveDocs(failedDocs);
        setError(t('Tugas berhasil dibuat. Beberapa folder belum tersimpan; periksa tautannya lalu coba simpan folder kembali.','Task created. Some folders could not be saved; check their links and try saving the folders again.'));
        return;
      }
      closeModal(); setNotice(t('Tugas berhasil dibuat. Buka tugas untuk melihat daftar peran dan progresnya.','Task created. Open it to view member roles and progress.'));
    } catch (e) { setError(e.response?.data?.message || e.message || t('Tugas belum dapat dibuat. Periksa koneksi Anda.', 'Could not create the task. Check your connection.')); }
    finally { setSaving(false); }
  }
  const statuses = ['all','assigned','in_progress','submitted','revision','completed'];
  const selectedEngagement = engagements.find(item => String(item.id) === String(form.engagement_id));
  const stepLabels = [t('Informasi tugas','Task details'),t('Peran anggota','Member roles'),t('Folder & ringkasan','Folders & summary')];
  const activeCount = targets.filter(item=>['assigned','in_progress','revision'].includes(item.status)).length;
  const reviewCount = targets.filter(item=>item.status==='submitted').length;
  const finishedCount = targets.filter(item=>item.status==='completed').length;
  return <div className="workspace-page tasks-workspace">
    <div className="page-heading">
      <div><span className="eyebrow">{t('Ruang kerja tim','Team workspace')}</span><h1>{t('Daftar tugas','Task list')}</h1><p>{admin ? t('Pantau progres setiap tugas, lalu buka peran untuk melihat pekerjaannya.','Track each task, then open a role to see its work.') : t('Pilih tugas, buka peran Anda, lalu perbarui progres pekerjaan.','Choose a task, open your role, then update your progress.')}</p></div>
      {admin ? <button ref={createButtonRef} className="btn-primary" onClick={()=>{setNotice('');setModal(true);navigate('/admin/targets?create=1')}}><Icon name="plus" size={17}/>{t('Buat tugas','Create task')}</button> : <Link className="btn-secondary" to="/member/upload"><Icon name="upload" size={16}/>{t('Kirim kertas kerja','Upload workpaper')}</Link>}
    </div>
    {notice&&<div className="alert alert-success" role="status">{notice}</div>}
    {!loading&&!failed&&<div className="task-overview-strip" aria-label={t('Ringkasan tugas','Task summary')}>
      <div><span className="task-stat-icon"><Icon name="target" size={19}/></span><div><strong>{activeCount}</strong><span>{t('Tugas aktif','Active tasks')}</span></div></div>
      <div><span className="task-stat-icon task-stat-review"><Icon name="clock" size={19}/></span><div><strong>{reviewCount}</strong><span>{t('Menunggu konfirmasi','Awaiting confirmation')}</span></div></div>
      <div><span className="task-stat-icon task-stat-done"><Icon name="check" size={19}/></span><div><strong>{finishedCount}</strong><span>{t('Tugas selesai','Completed tasks')}</span></div></div>
    </div>}
    <section className="panel tasks-list-panel">
      <div className="task-list-heading"><div><h2>{t('Semua tugas','All tasks')}</h2><p>{t('Progres keseluruhan dihitung dari rata-rata progres setiap peran.','Overall progress is the average progress of all member roles.')}</p></div>{!loading&&!failed&&<span className="task-count">{visible.length} {t('tugas','tasks')}</span>}</div>
      <div className="table-toolbar task-list-toolbar">
        <label className="search-box"><Icon name="search" size={18}/><input aria-label={t('Cari tugas atau anggota','Search tasks or members')} placeholder={t('Cari tugas atau anggota...','Search tasks or members...')} value={query} onChange={e=>setQuery(e.target.value)}/></label>
        <select className="filter-select" value={filter} onChange={e=>setFilter(e.target.value)} aria-label={t('Filter status tugas','Filter task status')}>{statuses.map(s=><option key={s} value={s}>{s==='all'?t('Semua status','All statuses'):t(s==='assigned'?'Ditugaskan':s==='in_progress'?'Sedang dikerjakan':s==='submitted'?'Menunggu konfirmasi':s==='revision'?'Perlu revisi':'Selesai',s.replace('_',' '))}</option>)}</select>
      </div>
      {loading?<LoadingState/>:failed?<div className="p-5"><ErrorState onRetry={()=>setAttempt(x=>x+1)}/></div>:visible.length===0&&(query||filter!=='all')?<div className="task-search-empty"><Icon name="search" size={28}/><h3>{t('Tidak ada tugas yang cocok','No matching tasks')}</h3><p>{t('Coba kata kunci lain atau tampilkan semua status.','Try another keyword or show all statuses.')}</p><button className="btn-secondary" onClick={()=>{setQuery('');setFilter('all')}}>{t('Reset pencarian','Reset search')}</button></div>:<TargetTable targets={visible}/>}
    </section>
    {admin&&modal&&createPortal(<div className="modal-layer task-create-layer" role="presentation" onMouseDown={e=>{if(e.target===e.currentTarget&&!saving)closeModal()}}>
      <section ref={dialogRef} className="modal task-create-dialog" role="dialog" aria-modal="true" aria-busy={saving} aria-labelledby="target-modal-title" aria-describedby="target-modal-description">
        <div className="modal-heading"><div><span className="task-form-eyebrow">{t('Penugasan baru','New assignment')}</span><h2 id="target-modal-title">{t('Buat tugas audit','Create audit task')}</h2><p id="target-modal-description">{t('Susun tugas dan bagikan pekerjaan kepada anggota tim.','Set up a task and assign the work to your team.')}</p></div><button className="icon-button" type="button" disabled={saving} aria-label={t('Tutup formulir','Close form')} onClick={closeModal}><Icon name="close" size={20}/></button></div>
        <nav className="task-form-steps" aria-label={t('Langkah pembuatan tugas','Task creation steps')}>{stepLabels.map((label,index)=><button key={label} type="button" className={index===step?'is-current':index<step?'is-complete':''} aria-current={index===step?'step':undefined} disabled={index>step||saving||Boolean(createdTarget)} onClick={()=>{setStep(index);setError('')}}><span>{index<step?<Icon name="check" size={15}/>:index+1}</span>{label}</button>)}</nav>
        {error&&<div role="alert" className="alert alert-error">{error}</div>}
        {loading ? <div className="task-modal-state" role="status"><span className="spinner"/>{t('Menyiapkan formulir tugas...', 'Preparing task form...')}</div> : failed ? <div className="task-modal-state"><ErrorState onRetry={()=>setAttempt(value=>value+1)}/></div> : members.length===0?<div className="task-no-members"><Icon name="users" size={32}/><h3>{t('Tambahkan anggota terlebih dahulu','Add members first')}</h3><p>{t('Setidaknya satu anggota dibutuhkan untuk menerima tugas.','At least one member is needed to receive a task.')}</p><Link className="btn-primary" to="/admin/members" onClick={()=>setModal(false)}>{t('Kelola anggota','Manage members')}</Link></div>:<form className="target-form task-guided-form" onSubmit={create}>
          {step===0&&<div className="task-step-content">
            <div className="task-section-intro"><h3>{t('Apa yang perlu dikerjakan?','What needs to be done?')}</h3><p>{t('Beri nama yang jelas dan tentukan tenggat tugas. Kolom bertanda * wajib diisi.','Use a clear name and set a due date. Fields marked * are required.')}</p></div>
            <div><label className="label" htmlFor="target-title">{t('Nama tugas','Task name')} *</label><input id="target-title" className="input" maxLength="200" required value={form.title} onChange={e=>setForm({...form,title:e.target.value})} placeholder={t('Contoh: Pemeriksaan belanja operasional','Example: Operational expenditure review')}/></div>
            <div><label className="label" htmlFor="target-engagement">{t('Judul audit','Audit title')} <span className="task-optional">{t('(opsional)','(optional)')}</span></label><input id="target-engagement" className="input" list="audit-title-options" maxLength="200" value={form.audit_title} onChange={e=>changeAuditTitle(e.target.value)} placeholder={t('Pilih audit yang tersedia atau tulis judul baru','Choose an existing audit or enter a title')} aria-describedby="audit-title-hint"/><datalist id="audit-title-options">{engagements.map(item=><option key={item.id} value={auditChoice(item)}/>)}</datalist><p id="audit-title-hint" className="field-hint">{selectedEngagement?t(`Program: ${selectedEngagement.program_title}.`,`Program: ${selectedEngagement.program_title}.`):t('Gunakan judul audit untuk mengelompokkan tugas yang berkaitan.','Use an audit title to group related tasks.')}</p></div>
            <div className="form-row"><div><label className="label" htmlFor="target-start">{t('Tanggal mulai','Start date')}</label><input id="target-start" type="date" className="input" min={selectedEngagement?.start_date} max={selectedEngagement?.due_date} value={form.start_date} onChange={e=>setForm({...form,start_date:e.target.value})}/></div><div><label className="label" htmlFor="target-due">{t('Tenggat tugas','Task due date')} *</label><input id="target-due" type="date" className="input" required min={[selectedEngagement?.start_date,form.start_date,selectedEngagement?null:minDueDate].filter(Boolean).sort().at(-1)} max={selectedEngagement?.due_date} value={form.due_date} onChange={e=>setForm({...form,due_date:e.target.value})}/></div></div>
            <div><label className="label" htmlFor="target-priority">{t('Prioritas','Priority')}</label><select id="target-priority" className="input" value={form.priority} onChange={e=>setForm({...form,priority:e.target.value})}><option value="low">{t('Rendah','Low')}</option><option value="medium">{t('Normal','Normal')}</option><option value="high">{t('Tinggi','High')}</option><option value="critical">{t('Kritis','Critical')}</option></select></div>
            <div><label className="label" htmlFor="target-description">{t('Arahan umum untuk tim','General team instructions')}</label><textarea id="target-description" className="input" rows="3" maxLength="5000" value={form.description} onChange={e=>setForm({...form,description:e.target.value})} placeholder={t('Jelaskan ruang lingkup dan hasil akhir yang diharapkan...','Describe the scope and expected outcome...')}/></div>
            <details className="task-optional-section"><summary>{t('Tambahkan kebutuhan data umum','Add general evidence requirements')}</summary><div><label className="label" htmlFor="target-evidence">{t('Bukti atau data untuk seluruh tim','Evidence or data for the whole team')}</label><textarea id="target-evidence" className="input" rows="2" maxLength="3000" value={form.evidence_needed} onChange={e=>setForm({...form,evidence_needed:e.target.value})}/><p className="field-hint">{t('Kebutuhan dokumen per peran dapat diisi pada langkah berikutnya.','Documents for each role can be specified in the next step.')}</p></div></details>
          </div>}
          {step===1&&<div className="task-step-content">
            <div className="task-section-intro"><h3>{t('Bagikan pekerjaan per peran','Assign work by role')}</h3><p>{t('Setiap peran menjadi satu subtugas, dengan anggota, target, dan progresnya sendiri.','Each role becomes a subtask with its own member, deliverables, and progress.')}</p></div>
            <RoleFields index={0} primary members={members} role={{role_name:primaryRoleName,user_id:form.assigned_to,...primaryRoleDetails}} onChange={patch=>{if('role_name'in patch)setPrimaryRoleName(patch.role_name);if('user_id'in patch)setForm({...form,assigned_to:patch.user_id});setPrimaryRoleDetails(current=>({...current,...('work_target'in patch?{work_target:patch.work_target}:{}),...('required_documents'in patch?{required_documents:patch.required_documents}:{})}))}}/>
            {additionalRoles.map((row,index)=><RoleFields key={index} index={index+1} members={members} role={row} onChange={patch=>setAdditionalRoles(rows=>rows.map((item,i)=>i===index?{...item,...patch}:item))} onRemove={()=>setAdditionalRoles(rows=>rows.filter((_,i)=>i!==index))}/>)}
            <button type="button" className="task-add-row" disabled={additionalRoles.length>=29} onClick={()=>setAdditionalRoles(rows=>[...rows,{role_name:'',user_id:'',work_target:'',required_documents:''}])}><Icon name="plus" size={18}/>{t('Tambah peran anggota','Add member role')}</button>
          </div>}
          {step===2&&<div className="task-step-content">
            <div className="task-section-intro"><h3>{t('Dokumen referensi untuk tim','Reference documents for the team')}</h3><p>{t('Tambahkan folder Google Drive agar semua anggota dapat melihat dokumennya. Langkah ini opsional.','Add Google Drive folders so all members can view the documents. This step is optional.')}</p></div>
            {driveDocs.length>0&&<div className="task-drive-tip"><Icon name="file" size={17}/><p>{t('Pastikan akses folder di Google Drive sudah diatur ke "Siapa saja yang memiliki link".','Set the Google Drive folder access to "Anyone with the link".')}</p></div>}
            {driveDocs.map((doc,index)=><div className="task-folder-fields" key={index}><div className="task-role-fields-head"><strong>{t('Folder','Folder')} {index+1}</strong><button type="button" className="task-remove-link" disabled={saving} onClick={()=>setDriveDocs(rows=>rows.filter((_,i)=>i!==index))}>{t('Hapus','Remove')}</button></div><div><label className="label" htmlFor={`folder-title-${index}`}>{t('Nama folder','Folder name')} *</label><input id={`folder-title-${index}`} className="input" placeholder={t('Contoh: Dokumen pendukung audit','Example: Audit supporting documents')} maxLength="200" required value={doc.title} onChange={e=>setDriveDocs(rows=>rows.map((item,i)=>i===index?{...item,title:e.target.value}:item))}/></div><div><label className="label" htmlFor={`folder-url-${index}`}>{t('Link folder Google Drive','Google Drive folder link')} *</label><input id={`folder-url-${index}`} className="input" type="url" required placeholder="https://drive.google.com/drive/folders/..." value={doc.drive_url} onChange={e=>setDriveDocs(rows=>rows.map((item,i)=>i===index?{...item,drive_url:e.target.value}:item))}/></div></div>)}
            <button type="button" className="task-add-row" disabled={saving} onClick={()=>setDriveDocs(rows=>[...rows,{title:'',drive_url:''}])}><Icon name="plus" size={18}/>{t('Tambah folder Google Drive','Add Google Drive folder')}</button>
            <div className="task-creation-summary"><span className="task-form-eyebrow">{t('Ringkasan tugas','Task summary')}</span><h4>{form.title}</h4><p>{1+additionalRoles.length} {t('peran anggota','member roles')} &middot; {driveDocs.length} {t('folder referensi','reference folders')}</p><p>{t('Tenggat','Due')}: {formatDate(form.due_date)}</p><span>{t('Setelah dibuat, anggota dapat membuka perannya dan memperbarui progres.','Once created, members can open their role and update progress.')}</span></div>
          </div>}
          <div className="task-form-footer"><span>{t(`Langkah ${step+1} dari 3`,`Step ${step+1} of 3`)}</span><div>{step>0&&!createdTarget&&<button type="button" className="btn-secondary" disabled={saving} onClick={()=>{setStep(step-1);setError('')}}><Icon name="back" size={16}/>{t('Kembali','Back')}</button>}<button type="submit" className="btn-primary" disabled={saving||!members.length}>{saving?t('Menyimpan...','Saving...'):step<2?t('Lanjut','Continue'):createdTarget?t('Simpan folder kembali','Retry saving folders'):t('Buat & bagikan tugas','Create & assign task')}{!saving&&<Icon name={step<2?'arrow':'check'} size={16}/>}</button></div></div>
        </form>}
      </section>
    </div>,document.body)}
  </div>;
}

function RoleFields({ role, index, primary, members, onChange, onRemove }) {
  const {t}=useLanguage();
  return <fieldset className="task-role-fields"><legend>{t('Peran','Role')} {index+1}</legend><div className="task-role-fields-head"><span>{primary?t('Anggota pertama menjadi penanggung jawab utama tugas.','The first member is the main task contact.'):t('Tentukan bagian pekerjaan anggota ini.',"Define this member\'s part of the work.")}</span>{onRemove&&<button className="task-remove-link" type="button" onClick={onRemove} aria-label={t(`Hapus peran ${index+1}`,`Remove role ${index+1}`)}>{t('Hapus peran','Remove role')}</button>}</div><div className="form-row"><div><label className="label" htmlFor={`role-name-${index}`}>{t('Nama peran','Role name')} *</label><input id={`role-name-${index}`} className="input" maxLength="100" required value={role.role_name} onChange={e=>onChange({role_name:e.target.value})} placeholder={t('Contoh: Analisis data','Example: Data analysis')}/></div><div><label className="label" htmlFor={`role-member-${index}`}>{t('Ditugaskan kepada','Assigned to')} *</label><select id={`role-member-${index}`} className="input" required value={role.user_id} onChange={e=>onChange({user_id:e.target.value})}><option value="">{t('Pilih anggota','Choose member')}</option>{members.map(member=><option key={member.id} value={member.id}>{member.name} - {member.email}</option>)}</select></div></div><div><label className="label" htmlFor={`role-target-${index}`}>{t('Target kerja','Deliverables')}</label><textarea id={`role-target-${index}`} className="input" rows="2" maxLength="3000" value={role.work_target} onChange={e=>onChange({work_target:e.target.value})} placeholder={t('Jelaskan hasil yang harus diselesaikan anggota ini...','Describe the results this member should deliver...')}/></div><div><label className="label" htmlFor={`role-documents-${index}`}>{t('Dokumen yang dibutuhkan','Required documents')}</label><textarea id={`role-documents-${index}`} className="input" rows="2" maxLength="3000" value={role.required_documents} onChange={e=>onChange({required_documents:e.target.value})} placeholder={t('Satu dokumen per baris','One document per line')}/></div></fieldset>;
}
