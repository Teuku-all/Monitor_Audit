import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import StatusBadge from '../../components/StatusBadge';
import { useLanguage } from '../../context/LanguageContext';
import { useAuth } from '../../context/AuthContext';
import api from '../../api/axios';

const STATUSES = ['Menunggu', 'Disetujui', 'Perlu Revisi'];

export default function AdminDetail() {
  const { id } = useParams();
  const { t, formatDate } = useLanguage();
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [comment, setComment] = useState('');
  const [loading, setLoading] = useState(true);
  const [attempt, setAttempt] = useState(0);
  const [loadError, setLoadError] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [savingStatus, setSavingStatus] = useState('');
  const [notice, setNotice] = useState('');
  const messages = {
    status: t('Status dokumen berhasil diperbarui.', 'Document status updated.'),
    comment: t('Komentar terkirim. Anggota dapat membalasnya di ruang kerja mereka.', 'Comment sent. The member can reply from their workspace.'),
    statusError: t('Status belum dapat diperbarui. Silakan coba lagi.', 'Unable to update the status. Please try again.'),
    commentError: t('Komentar belum terkirim. Tulisan Anda tetap tersimpan di form.', 'Your comment was not sent. Your draft is still in the form.'),
  };

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setLoadError(false);
    setNotice('');
    api.get(`/submissions/${id}`, { signal: controller.signal })
      .then(response => setData(response.data))
      .catch(() => { if (!controller.signal.aborted) setLoadError(true); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [id, attempt]);

  async function handleStatusChange(status) {
    if (savingStatus || status === data.status) return;
    setSavingStatus(status);
    setNotice('');
    try {
      await api.patch(`/submissions/${id}/status`, { status });
      setData(current => ({ ...current, status }));
      setNotice('status');
    } catch { setNotice('statusError'); }
    finally { setSavingStatus(''); }
  }

  async function handleComment(event) {
    event.preventDefault();
    const body = comment.trim();
    if (!body || submitting) return;
    setSubmitting(true);
    setNotice('');
    try {
      const response = await api.post(`/comments/${id}`, { body });
      setData(current => ({ ...current, comments: [...(current.comments || []), {
        id: response.data.id, body, admin_name: user.name, created_at: new Date().toISOString(), replies: [],
      }] }));
      setComment('');
      setNotice('comment');
    } catch { setNotice('commentError'); }
    finally { setSubmitting(false); }
  }

  if (loading) return <div role="status" className="panel p-10 text-center text-sm text-slate-500">{t('Memuat dokumen...', 'Loading document...')}</div>;
  if (loadError || !data) return <div className="panel p-8"><h1 className="text-lg font-semibold text-[#052659]">{t('Dokumen belum dapat ditampilkan', 'Unable to display this document')}</h1><p role="alert" className="mt-2 text-sm text-slate-500">{t('Periksa koneksi atau pastikan dokumen masih tersedia.', 'Check your connection or make sure the document is still available.')}</p><div className="mt-5 flex flex-wrap gap-3"><button className="btn-primary" onClick={() => setAttempt(value => value + 1)}>{t('Coba lagi', 'Try again')}</button><Link className="btn-secondary" to="/admin">{t('Ke dasbor', 'Back to dashboard')}</Link></div></div>;
  const conversationCount = (data.comments || []).reduce((total, item) => total + 1 + (item.replies?.length || 0), 0);

  return (
    <div className="space-y-6">
      <div><p className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-[#052659]">{t('Peninjauan dokumen', 'Document review')}</p><h1 className="page-title break-words">{data.title}</h1><p className="page-subtitle">{t('Dikirim oleh', 'Submitted by')} {data.member_name} &middot; {formatDate(data.submitted_at, { dateStyle: 'long' })}</p></div>
      {notice && <div role={notice.endsWith('Error') ? 'alert' : 'status'} className={`alert ${notice.endsWith('Error') ? 'alert-error' : 'border border-emerald-200 bg-emerald-50 text-emerald-800'}`}>{messages[notice]}</div>}
      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_300px]">
        <div className="min-w-0 space-y-6">
          <section className="panel p-5 sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="font-semibold text-[#052659]">{t('Detail dokumen', 'Document details')}</h2><StatusBadge status={data.status}/></div>
            <p className="mt-4 whitespace-pre-wrap break-words text-sm leading-7 text-slate-600">{data.description || t('Tidak ada deskripsi tambahan.', 'No additional description.')}</p>
            {data.target_id && <p className="mt-4 text-xs font-medium text-[#052659]">{t('Terkait target', 'Linked to target')} #{data.target_id}</p>}
            <a href={data.file_path} target="_blank" rel="noreferrer" className="mt-5 flex items-center gap-4 rounded-xl border border-slate-200 bg-slate-50 p-4 transition-colors hover:border-[#C2E8FF] hover:bg-[#C2E8FF]/20">
              <span aria-hidden="true" className="flex h-11 w-10 shrink-0 items-center justify-center rounded-lg bg-white text-[#052659]"><svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M14 3H6v18h12V7l-4-4Z"/><path d="M14 3v5h5M9 12h6M9 16h4"/></svg></span>
              <span className="min-w-0 flex-1"><span className="block break-all text-sm font-medium text-[#052659]">{data.file_name}</span><span className="mt-1 block text-xs text-slate-500">{t('Buka lampiran di tab baru', 'Open attachment in a new tab')}</span></span><span aria-hidden="true" className="text-[#052659]">↗</span>
            </a>
          </section>
          <section className="panel p-5 sm:p-6">
            <div className="flex items-center justify-between gap-3"><h2 className="font-semibold text-[#052659]">{t('Percakapan dokumen', 'Document conversation')}</h2><span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-500">{conversationCount} {t('pesan','messages')}</span></div>
            <div className="conversation-route"><span className="conversation-route-label">{t('Penerima','Recipient')}</span><strong>{data.member_name}</strong><span className="conversation-route-separator" aria-hidden="true">·</span><span>{t('Terkait dokumen ini','Attached to this document')}</span></div>
            <p className="mt-2 text-xs leading-5 text-slate-500">{t(`Pesan yang Anda kirim akan muncul di halaman dokumen ini pada ruang kerja ${data.member_name}. Anggota dapat membalas setiap pesan.`, `Messages you send appear on this document in ${data.member_name}’s workspace. The member can reply to each message.`)}</p>
            <div className="my-6 space-y-5">
              {!data.comments?.length ? <div className="rounded-xl border border-dashed border-slate-200 p-6 text-center"><p className="text-sm text-slate-500">{t('Belum ada pesan pada dokumen ini.', 'No messages on this document yet.')}</p><p className="mt-1 text-xs text-slate-400">{t('Tulis pesan di bawah untuk menghubungi anggota.', 'Write a message below to contact the member.')}</p></div> : data.comments.map(item => (
                <article key={item.id} className="rounded-2xl border border-slate-200 p-4 sm:p-5">
                  <div className="flex flex-wrap items-center justify-between gap-2"><div className="flex min-w-0 items-center gap-2.5"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#C2E8FF]/60 text-xs font-semibold text-[#052659]">{item.admin_name?.charAt(0).toUpperCase()}</span><span className="break-words text-sm font-semibold text-[#052659]">{item.admin_name}<span className="ml-2 text-[10px] font-normal text-slate-500">{t('Admin', 'Admin')}</span></span></div><time className="text-[11px] text-slate-400">{formatDate(item.created_at, { dateStyle: 'medium', timeStyle: 'short' })}</time></div>
                  <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-6 text-slate-600">{item.body}</p>
                  {!!item.replies?.length && <div className="mt-4 space-y-3 border-l-2 border-[#C2E8FF] pl-4">{item.replies.map(reply => <div key={reply.id} className="rounded-xl bg-slate-50 p-3 sm:p-4"><div className="flex flex-wrap justify-between gap-2"><span className="break-words text-xs font-semibold text-[#052659]">{reply.author_name}<span className="ml-2 font-normal text-slate-400">{t('Anggota', 'Member')}</span></span><time className="text-[10px] text-slate-400">{formatDate(reply.created_at, { dateStyle: 'medium', timeStyle: 'short' })}</time></div><p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-slate-600">{reply.body}</p></div>)}</div>}
                </article>
              ))}
            </div>
            <form onSubmit={handleComment} className="border-t border-slate-100 pt-5">
              <label className="label" htmlFor="admin-comment">{t(`Kirim pesan ke ${data.member_name}`, `Send a message to ${data.member_name}`)}</label>
              <textarea id="admin-comment" className="input min-h-[110px] resize-y" placeholder={t('Tulis arahan atau pertanyaan tentang dokumen ini...', 'Write guidance or a question about this document...')} value={comment} onChange={event => setComment(event.target.value)} maxLength={4000} rows={3} required disabled={submitting}/>
              <div className="mt-3 flex flex-wrap items-center justify-between gap-3"><span className="text-[11px] text-slate-400">{comment.length}/4000</span><button type="submit" className="btn-primary" disabled={submitting || !comment.trim()}>{submitting ? t('Mengirim...', 'Sending...') : t('Kirim ke anggota', 'Send to member')}<span aria-hidden="true">&rarr;</span></button></div>
            </form>
          </section>
        </div>
        <aside className="space-y-6">
          <section className="panel p-5 sm:p-6"><h2 className="font-semibold text-[#052659]">{t('Status peninjauan', 'Review status')}</h2><p className="mt-2 text-xs leading-5 text-slate-500">{t('Pilih hasil peninjauan dokumen ini.', 'Select the outcome of your document review.')}</p><div className="mt-5 space-y-2">{STATUSES.map(status => <button key={status} type="button" onClick={() => handleStatusChange(status)} aria-pressed={data.status === status} disabled={Boolean(savingStatus)} className={`flex w-full items-center justify-between rounded-xl border px-4 py-3 text-left text-sm transition-colors disabled:opacity-60 ${data.status === status ? 'border-[#052659] bg-[#C2E8FF]/25 font-semibold text-[#052659]' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}><span>{status === 'Menunggu' ? t('Menunggu tinjauan', 'Awaiting review') : status === 'Disetujui' ? t('Disetujui', 'Approved') : t('Perlu revisi', 'Revision needed')}</span><span aria-hidden="true">{savingStatus === status ? '…' : data.status === status ? '✓' : ''}</span></button>)}</div></section>
          <section className="panel p-5 sm:p-6"><h2 className="font-semibold text-[#052659]">{t('Pemilik dokumen', 'Document owner')}</h2><div className="mt-5 flex items-center gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#052659] text-sm font-semibold text-white">{data.member_name?.charAt(0).toUpperCase()}</span><div className="min-w-0"><p className="break-words text-sm font-semibold text-[#052659]">{data.member_name}</p><p className="mt-1 text-xs text-slate-500">{t('Anggota tim', 'Team member')}</p></div></div><p className="mt-4 break-all text-xs text-slate-500">{data.member_email}</p></section>
        </aside>
      </div>
    </div>
  );
}
