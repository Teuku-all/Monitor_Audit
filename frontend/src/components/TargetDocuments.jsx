import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/axios';
import { useLanguage } from '../context/LanguageContext';
import Icon from './Icon';
import StatusBadge from './StatusBadge';
import './TargetDocuments.css';

function drivePreview(file) {
  const id = encodeURIComponent(file.id);
  const types = { 'application/vnd.google-apps.document': 'document', 'application/vnd.google-apps.spreadsheet': 'spreadsheets', 'application/vnd.google-apps.presentation': 'presentation' };
  return types[file.mimeType] ? `https://docs.google.com/${types[file.mimeType]}/d/${id}/preview` : `https://drive.google.com/file/d/${id}/preview`;
}

function fileType(file, t) {
  const types = { 'application/vnd.google-apps.document': 'Google Docs', 'application/vnd.google-apps.spreadsheet': 'Google Sheets', 'application/vnd.google-apps.presentation': 'Google Slides', 'application/vnd.google-apps.folder': t('Folder', 'Folder'), 'application/pdf': 'PDF', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'Word', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'Excel', 'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'PowerPoint' };
  if (types[file.mimeType]) return types[file.mimeType];
  if (file.mimeType?.startsWith('image/')) return t('Gambar', 'Image');
  return (file.name || file.file_name || '').match(/\.([a-z0-9]{1,7})$/i)?.[1]?.toUpperCase() || t('Dokumen', 'Document');
}

function Preview({ title, src, externalUrl, externalLabel, id }) {
  const { t } = useLanguage();
  return <div className="td-preview" id={id} role="region" aria-label={`${t('Pratinjau', 'Preview')} ${title}`}>
    <div className="td-preview-toolbar"><span><Icon name="file" size={16}/>{title}</span><a href={externalUrl} target="_blank" rel="noreferrer">{externalLabel}<Icon name="arrow" size={15}/></a></div>
    <iframe title={`${t('Pratinjau', 'Preview')} ${title}`} src={src} loading="lazy" referrerPolicy="no-referrer"/>
    <p className="td-preview-help">{t('Pratinjau tidak muncul?', 'Preview not showing?')} <a href={externalUrl} target="_blank" rel="noreferrer">{externalLabel}</a></p>
  </div>;
}

function DriveFolder({ targetId, folder, admin, onRemove, removing, selectedPreview, onPreview }) {
  const { t } = useLanguage();
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [confirmRemove, setConfirmRemove] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError(false);
    api.get(`/targets/${targetId}/documents/${folder.id}/files`, { signal: controller.signal })
      .then(({ data }) => { if (!controller.signal.aborted) setFiles(data.files || []); })
      .catch(() => { if (!controller.signal.aborted) setError(true); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [targetId, folder.id, attempt]);

  return <article className="td-folder">
    <header className="td-folder-heading">
      <div className="td-folder-title"><span className="td-folder-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="M3 7V5a2 2 0 0 1 2-2h5l3 3h6a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z"/><path d="M3 8h18"/></svg></span><div><h3>{folder.title}</h3><p>{loading ? t('Memuat daftar dokumen…', 'Loading documents…') : error ? t('Daftar belum tersedia', 'List unavailable') : `${files.length} ${t('item dalam folder', 'items in this folder')}`}</p></div></div>
      <div className="td-folder-actions"><a className="td-subtle-link" href={folder.drive_url} target="_blank" rel="noreferrer">{t('Buka di Drive', 'Open in Drive')}<Icon name="arrow" size={14}/></a>{admin && <button type="button" className="td-icon-button" aria-label={`${t('Lepas folder', 'Unlink folder')} ${folder.title}`} title={t('Lepas folder dari tugas', 'Unlink folder from task')} disabled={removing} onClick={() => setConfirmRemove(value => !value)}><Icon name="close" size={17}/></button>}</div>
    </header>
    {confirmRemove && <div className="td-remove-confirm"><p>{t('Lepas tautan folder ini dari tugas? Dokumen di Google Drive tetap tersedia.', 'Unlink this folder from the task? Documents in Google Drive will remain available.')}</p><div><button className="td-danger-button" type="button" disabled={removing} onClick={() => onRemove(folder.id)}>{removing ? t('Melepas…', 'Unlinking…') : t('Lepas folder', 'Unlink folder')}</button><button className="td-plain-button" type="button" disabled={removing} onClick={() => setConfirmRemove(false)}>{t('Batal', 'Cancel')}</button></div></div>}
    {loading ? <div className="td-folder-state" role="status"><span className="td-loading-dot"/>{t('Menyiapkan daftar dokumen dari folder…', 'Loading documents from this folder…')}</div> : error ? <div className="td-folder-state td-folder-error" role="alert"><p>{t('Daftar dokumen belum dapat dimuat. Coba lagi atau buka folder di Drive.', 'Documents could not be loaded. Try again or open the folder in Drive.')}</p><button className="td-plain-button" type="button" onClick={() => setAttempt(value => value + 1)}><Icon name="refresh" size={15}/>{t('Coba lagi', 'Try again')}</button></div> : files.length === 0 ? <div className="td-folder-state"><Icon name="file" size={19}/><p>{t('Belum ada dokumen yang dapat ditampilkan di folder ini.', 'No documents can be displayed in this folder yet.')}</p></div> : <div className="td-file-list">
      {files.map(file => {
        const key = `drive:${folder.id}:${file.id}`;
        const open = selectedPreview === key;
        const panelId = `drive-preview-${folder.id}-${file.id}`;
        const isFolder = file.mimeType === 'application/vnd.google-apps.folder';
        const externalUrl = file.webViewLink || (isFolder ? `https://drive.google.com/drive/folders/${file.id}` : `https://drive.google.com/file/d/${file.id}/view`);
        return <div className={`td-file-item${open ? ' is-open' : ''}`} key={key}>
          {isFolder ? <a className="td-file-row" href={externalUrl} target="_blank" rel="noreferrer"><span className="td-file-icon"><Icon name="file" size={19}/></span><span className="td-file-copy"><strong>{file.name}</strong><small>{fileType(file, t)}</small></span><span className="td-row-action">{t('Buka folder', 'Open folder')}<Icon name="arrow" size={15}/></span></a> : <button className="td-file-row" type="button" aria-expanded={open} aria-controls={open ? panelId : undefined} onClick={() => onPreview(open ? null : key)}><span className="td-file-icon"><Icon name="file" size={19}/></span><span className="td-file-copy"><strong>{file.name}</strong><small>{fileType(file, t)}</small></span><span className="td-row-action">{open ? t('Tutup', 'Close') : t('Pratinjau', 'Preview')}<Icon name="chevron" size={15} className={open ? 'td-chevron is-open' : 'td-chevron'}/></span></button>}
          {open && <Preview id={panelId} title={file.name} src={drivePreview(file)} externalUrl={externalUrl} externalLabel={t('Buka di Drive', 'Open in Drive')}/>}
        </div>;
      })}
    </div>}
  </article>;
}

export default function TargetDocuments({ target, admin, canUpload = false, onChange }) {
  const { t, formatDate } = useLanguage();
  const targetRef = useRef(target);
  targetRef.current = target;
  const [showAdd, setShowAdd] = useState(false);
  const [draft, setDraft] = useState({ title: '', drive_url: '' });
  const [busy, setBusy] = useState(false);
  const [removingId, setRemovingId] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [selectedPreview, setSelectedPreview] = useState(null);
  const folders = target.drive_documents || [];
  const submissions = target.submissions || [];
  const base = admin ? '/admin' : '/member';
  useEffect(() => { setSelectedPreview(null); setError(''); setNotice(''); setShowAdd(false); }, [target.id]);

  async function addFolder(event) {
    event.preventDefault(); setBusy(true); setError(''); setNotice('');
    try {
      const { data } = await api.post(`/targets/${target.id}/documents`, { title: draft.title.trim(), drive_url: draft.drive_url.trim() });
      const current = targetRef.current;
      onChange({ ...current, drive_documents: [data, ...(current.drive_documents || [])] });
      setDraft({ title: '', drive_url: '' }); setShowAdd(false);
      setNotice(t('Folder ditambahkan. Semua anggota tugas dapat membuka dokumennya.', 'Folder added. All task members can view its documents.'));
    } catch (e) { setError(e.response?.data?.message || t('Folder belum tersimpan. Periksa tautannya lalu coba lagi.', 'Folder could not be saved. Check the link and try again.')); }
    finally { setBusy(false); }
  }

  async function removeFolder(id) {
    setRemovingId(id); setError(''); setNotice('');
    try {
      await api.delete(`/targets/${target.id}/documents/${id}`);
      const current = targetRef.current;
      onChange({ ...current, drive_documents: (current.drive_documents || []).filter(item => item.id !== id) });
      if (selectedPreview?.startsWith(`drive:${id}:`)) setSelectedPreview(null);
      setNotice(t('Tautan folder dilepas dari tugas.', 'Folder unlinked from the task.'));
    } catch (e) { setError(e.response?.data?.message || t('Tautan belum dapat dilepas. Coba lagi.', 'The folder could not be unlinked. Try again.')); }
    finally { setRemovingId(null); }
  }

  return <div className="task-documents">
    <section className="panel td-section" aria-labelledby="reference-documents-title">
      <header className="td-section-heading"><div><span className="td-eyebrow">{t('BAHAN KERJA BERSAMA', 'SHARED RESOURCES')}</span><h2 id="reference-documents-title">{t('Dokumen referensi', 'Reference documents')}<span className="td-count">{folders.length} {t('folder', 'folders')}</span></h2><p>{t('Buka baris dokumen untuk melihat isinya langsung di sini.', 'Select a document to preview it here.')}</p></div>{admin && <button type="button" className="btn-secondary" aria-expanded={showAdd} aria-controls={showAdd ? 'add-drive-folder' : undefined} onClick={() => { setShowAdd(value => !value); setError(''); }}><Icon name={showAdd ? 'close' : 'plus'} size={16}/>{showAdd ? t('Tutup formulir', 'Close form') : t('Tambah folder', 'Add folder')}</button>}</header>
      {notice && <p className="td-notice" role="status"><Icon name="check" size={16}/>{notice}</p>}
      {error && <p className="td-error" role="alert">{error}</p>}
      {admin && showAdd && <form className="td-add-form" id="add-drive-folder" onSubmit={addFolder}>
        <div className="td-add-fields"><label><span className="label">{t('Nama folder', 'Folder name')} <span aria-hidden="true">*</span></span><input className="input" required maxLength="200" autoFocus value={draft.title} onChange={event => setDraft({ ...draft, title: event.target.value })} placeholder={t('Contoh: Bukti audit pengadaan', 'For example: Procurement audit evidence')}/></label><label><span className="label">{t('Tautan folder Google Drive', 'Google Drive folder link')} <span aria-hidden="true">*</span></span><input className="input" type="url" required value={draft.drive_url} onChange={event => setDraft({ ...draft, drive_url: event.target.value })} placeholder="https://drive.google.com/drive/folders/…" aria-describedby="drive-sharing-help"/></label></div>
        <p className="td-help" id="drive-sharing-help">{t('Di Google Drive, atur akses folder ke “Siapa saja yang memiliki link” agar dokumen dapat dilihat oleh anggota.', 'In Google Drive, share the folder with “Anyone with the link” so members can view its documents.')}</p>
        <div className="td-form-actions"><button type="button" className="td-plain-button" disabled={busy} onClick={() => setShowAdd(false)}>{t('Batal', 'Cancel')}</button><button className="btn-primary" disabled={busy}><Icon name={busy ? 'clock' : 'plus'} size={16}/>{busy ? t('Menambahkan…', 'Adding…') : t('Tambahkan folder', 'Add folder')}</button></div>
      </form>}
      {!folders.length ? <div className="td-empty"><span className="td-empty-icon"><Icon name="file" size={24}/></span><div><strong>{t('Belum ada dokumen referensi', 'No reference documents yet')}</strong><p>{admin ? t('Tambahkan folder Drive berisi bahan yang diperlukan anggota untuk bekerja.', 'Add a Drive folder with the resources your members need.') : t('Folder yang dibagikan admin akan ditampilkan di sini.', 'Folders shared by the admin will appear here.')}</p></div></div> : <div className="td-folders">{folders.map(folder => <DriveFolder key={`${target.id}:${folder.id}`} targetId={target.id} folder={folder} admin={admin} onRemove={removeFolder} removing={removingId === folder.id} selectedPreview={selectedPreview} onPreview={setSelectedPreview}/>)}</div>}
    </section>
    <section className="panel td-section" aria-labelledby="workpaper-documents-title">
      <header className="td-section-heading"><div><span className="td-eyebrow">{t('HASIL PEKERJAAN', 'WORK OUTPUT')}</span><h2 id="workpaper-documents-title">{t('Kertas kerja', 'Workpapers')}<span className="td-count">{submissions.length}</span></h2><p>{t('Dokumen yang sudah dikirim oleh anggota dalam tugas ini.', 'Documents submitted by members for this task.')}</p></div>{canUpload && <Link className="btn-secondary" to={`/member/upload?target=${target.id}`}><Icon name="upload" size={16}/>{t('Kirim kertas kerja', 'Upload workpaper')}</Link>}</header>
      {!submissions.length ? <div className="td-empty"><span className="td-empty-icon"><Icon name="upload" size={23}/></span><div><strong>{t('Belum ada kertas kerja', 'No workpapers yet')}</strong><p>{t('Kertas kerja yang dikirim akan terkumpul di sini untuk ditinjau.', 'Submitted workpapers will appear here for review.')}</p></div></div> : <div className="td-workpapers">{submissions.map(doc => {
        const key = `workpaper:${doc.id}`;
        const open = selectedPreview === key;
        const canPreview = /\.(pdf|png|jpe?g)$/i.test(doc.file_name || '');
        const panelId = `workpaper-preview-${doc.id}`;
        return <article className={`td-workpaper${open ? ' is-open' : ''}`} key={doc.id}>
          <div className="td-workpaper-row"><span className="td-file-icon"><Icon name="file" size={20}/></span><div className="td-file-copy"><strong>{doc.title}</strong><small>{fileType(doc, t)} · {formatDate(doc.submitted_at)}</small></div><StatusBadge status={doc.status}/><div className="td-workpaper-actions">{canPreview && <button className="td-plain-button" type="button" aria-expanded={open} aria-controls={open ? panelId : undefined} onClick={() => setSelectedPreview(open ? null : key)}>{open ? t('Tutup', 'Close') : t('Pratinjau', 'Preview')}<Icon name="chevron" size={14} className={open ? 'td-chevron is-open' : 'td-chevron'}/></button>}<Link className="td-subtle-link" to={`${base}/submissions/${doc.id}`}>{t('Detail', 'Details')}<Icon name="arrow" size={15}/></Link></div></div>
          {open && <Preview id={panelId} title={doc.title} src={doc.preview_url || `/api/submissions/${doc.id}/preview`} externalUrl={doc.preview_url || `/api/submissions/${doc.id}/preview`} externalLabel={t('Buka dokumen', 'Open document')}/>}
          {!canPreview && <p className="td-format-help">{t('Buka detail untuk melihat atau mengunduh dokumen ini.', 'Open details to view or download this document.')}</p>}
        </article>;
      })}</div>}
    </section>
  </div>;
}
