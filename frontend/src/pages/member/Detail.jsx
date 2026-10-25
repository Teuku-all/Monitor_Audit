import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Navbar from '../../components/Navbar';
import StatusBadge from '../../components/StatusBadge';
import api from '../../api/axios';

const UPLOADS_URL = import.meta.env.VITE_UPLOADS_URL || 'http://localhost:3001/uploads';

export default function MemberDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [replyDrafts, setReplyDrafts] = useState({});
  const [replyingTo, setReplyingTo] = useState(null);
  const [replyError, setReplyError] = useState('');
  const [replyErrorFor, setReplyErrorFor] = useState(null);

  useEffect(() => {
    api.get(`/submissions/${id}`)
      .then(r => setData(r.data))
      .catch(() => navigate('/member'))
      .finally(() => setLoading(false));
  }, [id]);

  async function handleReply(e, comment) {
    e.preventDefault();
    const body = (replyDrafts[comment.id] || '').trim();
    if (!body || replyingTo !== null) return;

    setReplyingTo(comment.id);
    setReplyError('');
    setReplyErrorFor(null);
    try {
      const { data: result } = await api.post(`/comments/${id}/${comment.id}/replies`, { body });
      setData(current => ({
        ...current,
        comments: current.comments.map(item => item.id === comment.id
          ? { ...item, replies: [...(item.replies || []), result.reply] }
          : item),
      }));
      setReplyDrafts(current => ({ ...current, [comment.id]: '' }));
    } catch (err) {
      setReplyError(err.response?.data?.message || 'Balasan gagal dikirim. Coba lagi.');
      setReplyErrorFor(comment.id);
    } finally {
      setReplyingTo(null);
    }
  }

  if (loading) return <div className="min-h-screen bg-bg flex items-center justify-center text-gray-500">Memuat...</div>;

  return (
    <div className="min-h-screen bg-bg">
      <Navbar />
      <main className="page-container max-w-[900px]">
        <button onClick={() => navigate('/member')} className="back-link">
          ← Kembali ke Dashboard
        </button>

        <div className="card mb-6">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h1 className="text-xl font-bold text-white">{data.title}</h1>
              <p className="text-gray-500 text-sm mt-1">
                Diunggah pada {new Date(data.submitted_at).toLocaleDateString('id-ID', { dateStyle: 'long' })}
              </p>
            </div>
            <StatusBadge status={data.status} />
          </div>

          {data.description && (
            <p className="text-gray-400 text-sm leading-relaxed mb-4">{data.description}</p>
          )}

          <div className="pt-4 border-t border-border">
            <p className="text-xs text-gray-500 mb-2">Dokumen Terlampir</p>
            <a
              href={`${UPLOADS_URL}/${data.file_path}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 text-accent hover:text-accent-hover text-sm font-medium transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              {data.file_name}
            </a>
          </div>
        </div>

        {/* Admin feedback and member replies */}
        <div className="card">
          <h2 className="font-semibold text-white mb-4">
            Feedback dan balasan
            {data.comments?.length > 0 && (
              <span className="ml-2 text-xs bg-accent/20 text-accent px-2 py-0.5 rounded-full">{data.comments.length}</span>
            )}
          </h2>
          {data.comments?.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-600 text-sm">Belum ada feedback dari admin.</p>
              {data.status === 'Menunggu' && (
                <p className="text-gray-700 text-xs mt-1">Submission Anda sedang menunggu review.</p>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {data.comments.map(c => (
                <div key={c.id} className="rounded-2xl border border-border bg-bg p-4 sm:p-5">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-accent/20 flex items-center justify-center text-accent text-xs font-bold">
                        {c.admin_name?.charAt(0).toUpperCase()}
                      </div>
                      <span className="text-accent text-sm font-medium">{c.admin_name}</span>
                    </div>
                    <span className="text-gray-600 text-xs">
                      {new Date(c.created_at).toLocaleDateString('id-ID', { dateStyle: 'medium' })}
                    </span>
                  </div>
                  <p className="text-gray-200 text-sm leading-relaxed">{c.body}</p>

                  {c.replies?.length > 0 && (
                    <div className="mt-4 space-y-3 border-l border-[#5482B4]/40 pl-4 sm:ml-3 sm:pl-5">
                      {c.replies.map(reply => (
                        <div key={reply.id} className="rounded-xl border border-white/[0.06] bg-white/[0.025] p-3">
                          <div className="mb-2 flex items-center justify-between gap-3">
                            <div className="flex items-center gap-2">
                              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#5482B4]/20 text-xs font-semibold text-[#C2E8FF]">{reply.author_name?.charAt(0).toUpperCase()}</div>
                              <span className="text-sm font-medium text-[#C2E8FF]">{reply.author_name} <span className="ml-1 text-[10px] font-normal uppercase tracking-wide text-gray-500">Anda</span></span>
                            </div>
                            <span className="text-[11px] text-gray-500">{new Date(reply.created_at).toLocaleDateString('id-ID', { dateStyle: 'medium' })}</span>
                          </div>
                          <p className="whitespace-pre-wrap text-sm leading-relaxed text-gray-300">{reply.body}</p>
                        </div>
                      ))}
                    </div>
                  )}

                  <form onSubmit={e => handleReply(e, c)} className="mt-4">
                    <label className="sr-only" htmlFor={`reply-${c.id}`}>Balas komentar admin</label>
                    <textarea
                      id={`reply-${c.id}`}
                      className="input min-h-[78px] resize-y text-sm"
                      placeholder="Tulis balasan untuk admin..."
                      value={replyDrafts[c.id] || ''}
                      onChange={e => setReplyDrafts(current => ({ ...current, [c.id]: e.target.value }))}
                      maxLength={2000}
                      rows={2}
                    />
                    {replyError && replyErrorFor === c.id && <p role="alert" className="mt-2 text-xs text-rose-300">{replyError}</p>}
                    <div className="mt-2 flex items-center justify-between gap-3">
                      <span className="text-[11px] text-gray-600">Balasan akan terlihat oleh tim audit.</span>
                      <button type="submit" className="btn-primary px-3 py-2 text-xs" disabled={replyingTo !== null || !(replyDrafts[c.id] || '').trim()}>
                        {replyingTo === c.id ? 'Mengirim...' : 'Kirim balasan'}
                        {replyingTo !== c.id && <span aria-hidden="true">→</span>}
                      </button>
                    </div>
                  </form>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
