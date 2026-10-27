import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import StatusBadge from '../../components/StatusBadge';
import { useLanguage } from '../../context/LanguageContext';
import api from '../../api/axios';


export default function MemberDetail() {
  const { id } = useParams();
  const { t, formatDate } = useLanguage();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [replyDrafts, setReplyDrafts] = useState({});
  const [replyingTo, setReplyingTo] = useState(null);
  const [replyErrorFor, setReplyErrorFor] = useState(null);
  const [replySuccessFor, setReplySuccessFor] = useState(null);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setLoadError(false);
    setReplyErrorFor(null);
    setReplySuccessFor(null);
    api.get(`/submissions/${id}`, { signal: controller.signal })
      .then(response => setData(response.data))
      .catch(() => { if (!controller.signal.aborted) setLoadError(true); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [id, attempt]);

  async function handleReply(event, comment) {
    event.preventDefault();
    const body = (replyDrafts[comment.id] || '').trim();
    if (!body || replyingTo !== null) return;
    setReplyingTo(comment.id);
    setReplyErrorFor(null);
    setReplySuccessFor(null);
    try {
      const { data: result } = await api.post(`/comments/${id}/${comment.id}/replies`, { body });
      setData(current => ({
        ...current,
        comments: current.comments.map(item => item.id === comment.id
          ? { ...item, replies: [...(item.replies || []), result.reply] }
          : item),
      }));
      setReplyDrafts(current => ({ ...current, [comment.id]: '' }));
      setReplySuccessFor(comment.id);
    } catch { setReplyErrorFor(comment.id); }
    finally { setReplyingTo(null); }
  }

  if (loading) return <div role="status" className="panel p-10 text-center text-sm text-slate-500">{t('Memuat dokumen...', 'Loading document...')}</div>;
  if (loadError || !data) return <div className="panel p-8"><h1 className="text-lg font-semibold text-[#052659]">{t('Dokumen belum dapat ditampilkan', 'Unable to display this document')}</h1><p role="alert" className="mt-2 text-sm text-slate-500">{t('Periksa koneksi atau pastikan dokumen masih tersedia.', 'Check your connection or make sure the document is still available.')}</p><div className="mt-5 flex flex-wrap gap-3"><button className="btn-primary" onClick={() => setAttempt(value => value + 1)}>{t('Coba lagi', 'Try again')}</button><Link className="btn-secondary" to="/member">{t('Ke dasbor', 'Back to dashboard')}</Link></div></div>;
  const conversationCount = (data.comments || []).reduce((total, item) => total + 1 + (item.replies?.length || 0), 0);

  return (
    <div className="mx-auto max-w-[920px] space-y-6">
      <div><p className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-[#052659]">{t('Dokumen saya', 'My document')}</p><h1 className="page-title break-words">{data.title}</h1><p className="page-subtitle">{t('Dikirim pada', 'Submitted on')} {formatDate(data.submitted_at, { dateStyle: 'long' })}</p></div>
      <section className="panel p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="font-semibold text-[#052659]">{t('Detail dokumen', 'Document details')}</h2><StatusBadge status={data.status}/></div>
        <p className="mt-4 whitespace-pre-wrap break-words text-sm leading-7 text-slate-600">{data.description || t('Tidak ada deskripsi tambahan.', 'No additional description.')}</p>
        {data.target_id && <p className="mt-4 text-xs font-medium text-[#052659]">{t('Terkait target', 'Linked to target')} #{data.target_id}</p>}
        <a href={data.file_url} className="mt-5 flex items-center gap-4 rounded-xl border border-slate-200 bg-slate-50 p-4 transition-colors hover:border-[#C2E8FF] hover:bg-[#C2E8FF]/20">
          <span aria-hidden="true" className="flex h-11 w-10 shrink-0 items-center justify-center rounded-lg bg-white text-[#052659]"><svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M14 3H6v18h12V7l-4-4Z"/><path d="M14 3v5h5M9 12h6M9 16h4"/></svg></span>
          <span className="min-w-0 flex-1"><span className="block break-all text-sm font-medium text-[#052659]">{data.file_name}</span><span className="mt-1 block text-xs text-slate-500">{t('Unduh lampiran dengan aman', 'Securely download attachment')}</span></span><span aria-hidden="true" className="text-[#052659]">↓</span>
        </a>
      </section>
      <section className="panel p-5 sm:p-6">
        <div className="flex items-center justify-between gap-3"><h2 className="font-semibold text-[#052659]">{t('Percakapan dokumen', 'Document conversation')}</h2><span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-500">{conversationCount} {t('pesan','messages')}</span></div>
        <div className="conversation-route"><span className="conversation-route-label">{t('Penerima balasan','Reply recipient')}</span><strong>{t('Admin tim audit','Audit team admin')}</strong><span className="conversation-route-separator" aria-hidden="true">·</span><span>{t('Tersimpan pada dokumen ini','Saved with this document')}</span></div>
        <p className="mt-2 text-xs leading-5 text-slate-500">{t('Balas komentar admin di bawah. Balasan Anda akan masuk ke admin tim audit dan tetap terhubung dengan dokumen ini.', 'Reply to an admin comment below. Your reply goes to the audit team admin and stays attached to this document.')}</p>
        {!data.comments?.length ? <div className="mt-6 rounded-xl border border-dashed border-slate-200 px-5 py-10 text-center"><p className="text-sm font-medium text-slate-600">{t('Belum ada pesan dari admin.', 'No messages from the admin yet.')}</p><p className="mt-2 text-xs text-slate-400">{data.status === 'Menunggu' ? t('Dokumen Anda sedang menunggu peninjauan. Komentar admin dan tombol balas akan muncul di sini.', 'Your document is waiting for review. The admin’s comment and reply option will appear here.') : t('Komentar admin dan balasan Anda akan tersimpan pada percakapan dokumen ini.', 'Admin comments and your replies are saved in this document conversation.')}</p></div> : (
          <div className="mt-6 space-y-5">{data.comments.map(comment => (
            <article key={comment.id} className="rounded-2xl border border-slate-200 p-4 sm:p-5">
              <div className="flex flex-wrap items-center justify-between gap-2"><div className="flex min-w-0 items-center gap-2.5"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#C2E8FF]/60 text-xs font-semibold text-[#052659]">{comment.admin_name?.charAt(0).toUpperCase()}</span><span className="break-words text-sm font-semibold text-[#052659]">{comment.admin_name}<span className="ml-2 text-[10px] font-normal text-slate-500">{t('Admin', 'Admin')}</span></span></div><time className="text-[11px] text-slate-400">{formatDate(comment.created_at, { dateStyle: 'medium', timeStyle: 'short' })}</time></div>
              <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-6 text-slate-600">{comment.body}</p>
              {!!comment.replies?.length && <div className="mt-4 space-y-3 border-l-2 border-[#C2E8FF] pl-4">{comment.replies.map(reply => <div key={reply.id} className="rounded-xl bg-slate-50 p-3 sm:p-4"><div className="flex flex-wrap justify-between gap-2"><span className="break-words text-xs font-semibold text-[#052659]">{reply.author_name}<span className="ml-2 font-normal text-slate-400">{t('Anda', 'You')}</span></span><time className="text-[10px] text-slate-400">{formatDate(reply.created_at, { dateStyle: 'medium', timeStyle: 'short' })}</time></div><p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-slate-600">{reply.body}</p></div>)}</div>}
              <form onSubmit={event => handleReply(event, comment)} className="mt-5 border-t border-slate-100 pt-4">
                <label className="label" htmlFor={`reply-${comment.id}`}>{t('Balas kepada admin', 'Reply to the admin')}</label>
                <textarea id={`reply-${comment.id}`} className="input min-h-[88px] resize-y" placeholder={t('Tulis balasan tentang dokumen ini...', 'Write a reply about this document...')} value={replyDrafts[comment.id] || ''} onChange={event => { setReplyDrafts(current => ({ ...current, [comment.id]: event.target.value })); if (replySuccessFor === comment.id) setReplySuccessFor(null); }} maxLength={2000} rows={2} required disabled={replyingTo === comment.id}/>
                {replyErrorFor === comment.id && <p role="alert" className="mt-2 text-xs text-rose-600">{t('Balasan belum terkirim. Silakan coba lagi.', 'Your reply was not sent. Please try again.')}</p>}
                {replySuccessFor === comment.id && <p role="status" className="mt-2 text-xs text-emerald-700">{t('Balasan berhasil dikirim.', 'Reply sent successfully.')}</p>}
                <div className="mt-3 flex flex-wrap items-center justify-between gap-3"><span className="text-[11px] text-slate-400">{(replyDrafts[comment.id] || '').length}/2000 &middot; {t('Dikirim ke admin tim audit', 'Sent to the audit team admin')}</span><button type="submit" className="btn-primary" disabled={replyingTo !== null || !(replyDrafts[comment.id] || '').trim()}>{replyingTo === comment.id ? t('Mengirim...', 'Sending...') : t('Kirim balasan ke admin', 'Send reply to admin')}<span aria-hidden="true">&rarr;</span></button></div>
              </form>
            </article>
          ))}</div>
        )}
      </section>
    </div>
  );
}
